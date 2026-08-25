package http

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/sentinelpulse/backend/internal/telemetry"
)

func TestRequireDeviceAuthRejectsMissingBearer(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	called := false
	handler := (&Server{db: db}).requireDeviceAuth(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized || called {
		t.Fatalf("expected 401 without calling downstream, got status=%d called=%v", res.Code, called)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRequireDeviceAuthRejectsUnknownOrRevokedDevice(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	rawToken := "sp-agent-revoked-token"
	hash := sha256.Sum256([]byte(rawToken))
	expected := mock.ExpectQuery(regexp.QuoteMeta("SELECT c.endpoint_id, e.tenant_id\n\t\t\tFROM endpoint_credentials c\n\t\t\tJOIN endpoints e ON e.id = c.endpoint_id\n\t\t\tWHERE c.device_token_hash = $1 AND c.revoked = FALSE"))
	expected.WithArgs(hex.EncodeToString(hash[:]))
	expected.WillReturnError(sql.ErrNoRows)

	handler := (&Server{db: db}).requireDeviceAuth(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry", nil)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for revoked/unknown device, got %d", res.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestAuthenticatedDeviceCannotSubmitForAnotherEndpoint(t *testing.T) {
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

	rawToken := "sp-agent-tenant-a"
	hash := sha256.Sum256([]byte(rawToken))
	expected := mock.ExpectQuery(regexp.QuoteMeta("SELECT c.endpoint_id, e.tenant_id\n\t\t\tFROM endpoint_credentials c\n\t\t\tJOIN endpoints e ON e.id = c.endpoint_id\n\t\t\tWHERE c.device_token_hash = $1 AND c.revoked = FALSE"))
	expected.WithArgs(hex.EncodeToString(hash[:]))
	expected.WillReturnRows(sqlmock.NewRows([]string{"endpoint_id", "tenant_id"}).AddRow("endpoint-a", "tenant-a"))

	handler := (&Server{db: db}).requireDeviceAuth(telemetry.HandleTelemetryIngest(redisClient, "telemetry"))
	body := bytes.NewBufferString(`{"event_id":"event-cross","endpoint_id":"endpoint-b","capture_time":"2026-08-25T00:00:00Z","module":"system","payload":{"cpu_utilization":12.5}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry", body)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for wrong endpoint, got %d", res.Code)
	}
	if _, err := redisClient.XRange(req.Context(), "telemetry", "-", "+").Result(); err != nil {
		t.Fatal(err)
	}
	messages, err := redisClient.XRange(req.Context(), "telemetry", "-", "+").Result()
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 0 {
		t.Fatalf("expected no cross-tenant telemetry to be queued, got %d messages", len(messages))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRequireDeviceAuthLoadsTenantScopedIdentity(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	rawToken := "sp-agent-test-token"
	hash := sha256.Sum256([]byte(rawToken))
	expected := mock.ExpectQuery(regexp.QuoteMeta("SELECT c.endpoint_id, e.tenant_id\n\t\t\tFROM endpoint_credentials c\n\t\t\tJOIN endpoints e ON e.id = c.endpoint_id\n\t\t\tWHERE c.device_token_hash = $1 AND c.revoked = FALSE"))
	expected.WithArgs(hex.EncodeToString(hash[:]))
	expected.WillReturnRows(sqlmock.NewRows([]string{"endpoint_id", "tenant_id"}).AddRow("endpoint-1", "tenant-1"))

	called := false
	handler := (&Server{db: db}).requireDeviceAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		identity, ok := telemetry.DeviceIdentityFromContext(r.Context())
		if !ok || identity.EndpointID != "endpoint-1" || identity.TenantID != "tenant-1" {
			t.Errorf("unexpected device identity: %#v ok=%v", identity, ok)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry", nil)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusNoContent || !called {
		t.Fatalf("expected authenticated downstream request, got status=%d called=%v", res.Code, called)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
