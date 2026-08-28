package telemetry

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestWorkerPersistsRealMetricsAndTenant(t *testing.T) {
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

	payload := []byte(`{"cpu_utilization":12.5,"ram_utilization":67.25,"disk_utilization":41.75}`)
	envelope := `{"schema_version":"1.0","event_id":"event-1","endpoint_id":"endpoint-1","tenant_id":"tenant-1","sequence_number":3,"capture_time":"2026-08-25T00:00:00Z","module":"system","payload":` + string(payload) + `}`
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
	insert.WithArgs("tenant-1", "endpoint-1", sqlmock.AnyArg(), 12.5, 67.25, 41.75, payload)
	insert.WillReturnResult(sqlmock.NewResult(1, 1))
	update := mock.ExpectExec(`(?s)UPDATE endpoints.*status_reason.*status_changed_at.*last_seen`)
	update.WithArgs("endpoint-1", "tenant-1", sqlmock.AnyArg())
	update.WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	worker := NewWorker(db, redisClient, "telemetry", "group", "consumer")
	if err := worker.ProcessMessage(context.Background(), messages[0]); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
