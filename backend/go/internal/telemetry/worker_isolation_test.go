package telemetry

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestWorkerRejectsEndpointOutsideAuthenticatedTenant(t *testing.T) {
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

	envelope := `{"event_id":"event-cross-tenant","endpoint_id":"endpoint-owned-by-tenant-a","tenant_id":"tenant-b","capture_time":"2026-08-25T00:00:00Z","module":"system","payload":{"cpu_utilization":12.5}}`
	messageID, err := redisClient.XAdd(context.Background(), &redis.XAddArgs{Stream: "telemetry", Values: map[string]interface{}{"envelope": envelope}}).Result()
	if err != nil {
		t.Fatal(err)
	}
	messages, err := redisClient.XRange(context.Background(), "telemetry", messageID, messageID).Result()
	if err != nil || len(messages) != 1 {
		t.Fatalf("failed to read test message: %v", err)
	}

	mock.ExpectBegin()
	insert := mock.ExpectExec("INSERT INTO endpoint_metrics_hyper")
	insert.WithArgs("tenant-b", "endpoint-owned-by-tenant-a", sqlmock.AnyArg(), 12.5, nil, nil, []byte(`{"cpu_utilization":12.5}`))
	insert.WillReturnResult(sqlmock.NewResult(1, 1))
	update := mock.ExpectExec("UPDATE endpoints")
	update.WithArgs("endpoint-owned-by-tenant-a", "tenant-b", sqlmock.AnyArg())
	update.WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	worker := NewWorker(db, redisClient, "telemetry", "group", "consumer")
	if err := worker.ProcessMessage(context.Background(), messages[0]); err == nil {
		t.Fatal("expected cross-tenant endpoint telemetry to be rejected")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
