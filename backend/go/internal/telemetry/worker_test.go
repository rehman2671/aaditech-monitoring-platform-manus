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

func TestWorkerPersistsObservedProcessSamplesWithNullableEvidence(t *testing.T) {
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

	payload := []byte(`{"cpu_utilization":null,"ram_utilization":null,"disk_utilization":null,"diagnostics":{"processes":{"status":"ok","items":[{"pid":42,"name":"chrome.exe","cpu_percent":12.5,"ram_mb":64,"username":"DOMAIN\\user","executable_path":"C:\\\\Program Files\\\\Google\\\\Chrome\\\\chrome.exe","signature_status":"signed","parent_pid":7,"cpu_time_seconds":10.25,"thread_count":4,"state":"running","availability":"observed"}]}}}`)
	envelope := `{"schema_version":"1.0","event_id":"event-process-1","endpoint_id":"endpoint-1","tenant_id":"tenant-1","sequence_number":4,"capture_time":"2026-08-25T00:00:00Z","module":"system","payload":` + string(payload) + `}`
	messageID, err := redisClient.XAdd(context.Background(), &redis.XAddArgs{Stream: "telemetry", Values: map[string]interface{}{"envelope": envelope}}).Result()
	if err != nil {
		t.Fatal(err)
	}
	messages, err := redisClient.XRange(context.Background(), "telemetry", messageID, messageID).Result()
	if err != nil || len(messages) != 1 {
		t.Fatalf("failed to read test message: %v", err)
	}

	mock.ExpectBegin()
	metrics := mock.ExpectExec("INSERT INTO endpoint_metrics_hyper")
	metrics.WithArgs("tenant-1", "endpoint-1", sqlmock.AnyArg(), nil, nil, nil, payload)
	metrics.WillReturnResult(sqlmock.NewResult(1, 1))
	process := mock.ExpectExec("INSERT INTO endpoint_process_samples")
	process.WithArgs(
		"tenant-1", "endpoint-1", sqlmock.AnyArg(), 42, "chrome.exe",
		"C:\\\\Program Files\\\\Google\\\\Chrome\\\\chrome.exe", nil, nil, "signed", nil,
		7, nil, nil, "DOMAIN\\user", 12.5, 10.25, uint64(64*1024*1024), nil, nil,
		4, nil, nil, nil, "running", "OBSERVED", payload,
	)
	process.WillReturnResult(sqlmock.NewResult(1, 1))
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

func TestWorkerSkipsProcessPersistenceWhenCollectorDidNotObserveProcesses(t *testing.T) {
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

	payload := []byte(`{"cpu_utilization":null,"ram_utilization":null,"disk_utilization":null,"diagnostics":{"processes":{"status":"timeout","items":[]}}}`)
	envelope := `{"schema_version":"1.0","event_id":"event-process-timeout","endpoint_id":"endpoint-1","tenant_id":"tenant-1","sequence_number":5,"capture_time":"2026-08-25T00:00:00Z","module":"system","payload":` + string(payload) + `}`
	messageID, err := redisClient.XAdd(context.Background(), &redis.XAddArgs{Stream: "telemetry", Values: map[string]interface{}{"envelope": envelope}}).Result()
	if err != nil {
		t.Fatal(err)
	}
	messages, err := redisClient.XRange(context.Background(), "telemetry", messageID, messageID).Result()
	if err != nil || len(messages) != 1 {
		t.Fatalf("failed to read test message: %v", err)
	}

	mock.ExpectBegin()
	metrics := mock.ExpectExec("INSERT INTO endpoint_metrics_hyper")
	metrics.WithArgs("tenant-1", "endpoint-1", sqlmock.AnyArg(), nil, nil, nil, payload)
	metrics.WillReturnResult(sqlmock.NewResult(1, 1))
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

func TestWorkerAppliesConfiguredProcessRetention(t *testing.T) {
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

	payload := []byte(`{"cpu_utilization":null,"ram_utilization":null,"disk_utilization":null}`)
	envelope := `{"schema_version":"1.0","event_id":"event-retention-1","endpoint_id":"endpoint-1","tenant_id":"tenant-1","sequence_number":6,"capture_time":"2026-08-25T00:00:00Z","module":"system","payload":` + string(payload) + `}`
	messageID, err := redisClient.XAdd(context.Background(), &redis.XAddArgs{Stream: "telemetry", Values: map[string]interface{}{"envelope": envelope}}).Result()
	if err != nil {
		t.Fatal(err)
	}
	messages, err := redisClient.XRange(context.Background(), "telemetry", messageID, messageID).Result()
	if err != nil || len(messages) != 1 {
		t.Fatalf("failed to read test message: %v", err)
	}

	mock.ExpectBegin()
	metrics := mock.ExpectExec("INSERT INTO endpoint_metrics_hyper")
	metrics.WithArgs("tenant-1", "endpoint-1", sqlmock.AnyArg(), nil, nil, nil, payload)
	metrics.WillReturnResult(sqlmock.NewResult(1, 1))
	purge := mock.ExpectExec("DELETE FROM endpoint_process_samples")
	purge.WithArgs("tenant-1", "endpoint-1", sqlmock.AnyArg())
	purge.WillReturnResult(sqlmock.NewResult(1, 0))
	update := mock.ExpectExec(`(?s)UPDATE endpoints.*status_reason.*status_changed_at.*last_seen`)
	update.WithArgs("endpoint-1", "tenant-1", sqlmock.AnyArg())
	update.WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	worker := NewWorkerWithRetention(db, redisClient, "telemetry", "group", "consumer", 7)
	if err := worker.ProcessMessage(context.Background(), messages[0]); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
