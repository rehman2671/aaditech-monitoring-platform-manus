package http

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/sentinelpulse/backend/internal/config"
	"github.com/sentinelpulse/backend/internal/telemetry"
)

func TestTelemetryFullPathRejectsCrossTenantEndpoint(t *testing.T) {
	redisServer, err := miniredis.Run()
	if err != nil {
		t.Fatal(err)
	}
	defer redisServer.Close()
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	defer redisClient.Close()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	rawToken := "sp-agent-tenant-b"
	hash := sha256.Sum256([]byte(rawToken))
	expected := mock.ExpectQuery(regexp.QuoteMeta("SELECT c.endpoint_id, e.tenant_id\n\t\t\tFROM endpoint_credentials c\n\t\t\tJOIN endpoints e ON e.id = c.endpoint_id\n\t\t\tWHERE c.device_token_hash = $1 AND c.revoked = FALSE"))
	expected.WithArgs(hex.EncodeToString(hash[:]))
	expected.WillReturnRows(sqlmock.NewRows([]string{"endpoint_id", "tenant_id"}).AddRow("endpoint-b", "tenant-b"))

	server := NewServer(&config.Config{StreamName: "telemetry"}, db, redisClient)
	body := bytes.NewBufferString(`{"event_id":"event-cross","endpoint_id":"endpoint-a","capture_time":"2026-08-25T00:00:00Z","module":"system","payload":{"cpu_utilization":12.5}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry", body)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	res := httptest.NewRecorder()
	server.RegisterRoutes().ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP ingress to reject wrong endpoint, got %d", res.Code)
	}
	messages, err := redisClient.XRange(context.Background(), "telemetry", "-", "+").Result()
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 0 {
		t.Fatalf("expected rejected request not to enter Redis, got %d messages", len(messages))
	}

	// Exercise the worker’s persistence guard with the same tenant-scoped identity
	// attempting to affect an endpoint owned by another tenant.
	crossTenantEnvelope := `{"event_id":"event-worker-cross","endpoint_id":"endpoint-a","tenant_id":"tenant-b","capture_time":"2026-08-25T00:00:00Z","module":"system","payload":{"cpu_utilization":12.5}}`
	messageID, err := redisClient.XAdd(context.Background(), &redis.XAddArgs{Stream: "telemetry", Values: map[string]interface{}{"envelope": crossTenantEnvelope}}).Result()
	if err != nil {
		t.Fatal(err)
	}
	workerMessages, err := redisClient.XRange(context.Background(), "telemetry", messageID, messageID).Result()
	if err != nil || len(workerMessages) != 1 {
		t.Fatalf("failed to read worker test message: %v", err)
	}

	mock.ExpectBegin()
	insert := mock.ExpectExec("INSERT INTO endpoint_metrics_hyper")
	insert.WithArgs("tenant-b", "endpoint-a", sqlmock.AnyArg(), 12.5, nil, nil, []byte(`{"cpu_utilization":12.5}`))
	insert.WillReturnResult(sqlmock.NewResult(1, 1))
	update := mock.ExpectExec("UPDATE endpoints")
	update.WithArgs("endpoint-a", "tenant-b", sqlmock.AnyArg())
	update.WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	worker := telemetry.NewWorker(db, redisClient, "telemetry", "group", "consumer")
	if err := worker.ProcessMessage(context.Background(), workerMessages[0]); err == nil {
		t.Fatal("expected worker to reject cross-tenant endpoint persistence")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
