package main

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func openIntegrationDB(t *testing.T) *sql.DB {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgres://sentinel_test:sentinel_test@127.0.0.1:5432/sentinel_test?sslmode=disable"
	}
	db, err := sql.Open("postgres", url)
	if err != nil {
		t.Skipf("PostgreSQL integration unavailable: %v", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		t.Skipf("PostgreSQL integration unavailable: %v", err)
	}
	return db
}

func prepareWorkerSchema(t *testing.T, db *sql.DB) {
	t.Helper()
	statements := []string{
		`CREATE TABLE IF NOT EXISTS endpoints (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL, hostname VARCHAR(255) NOT NULL, serial_number VARCHAR(128) NOT NULL, os_version VARCHAR(128), agent_version VARCHAR(64), status VARCHAR(32) NOT NULL DEFAULT 'online', last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS os_version VARCHAR(128)`,
		`ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS agent_version VARCHAR(64)`,
		`CREATE TABLE IF NOT EXISTS metrics_history (captured_at TIMESTAMPTZ NOT NULL, endpoint_id VARCHAR(64) NOT NULL, cpu_usage_percent DECIMAL(5,2), ram_usage_percent DECIMAL(5,2), disk_free_percent DECIMAL(5,2), network_io_kbps DECIMAL(12,2))`,
		`CREATE TABLE IF NOT EXISTS alert_rules (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL, name TEXT NOT NULL, metric VARCHAR(64) NOT NULL, condition VARCHAR(16) NOT NULL, threshold_value DECIMAL(10,2) NOT NULL, severity VARCHAR(32) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE)`,
		`CREATE TABLE IF NOT EXISTS system_alerts (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL, endpoint_id VARCHAR(64) NOT NULL, hostname VARCHAR(255) NOT NULL, rule_name TEXT NOT NULL, severity VARCHAR(32) NOT NULL, message TEXT NOT NULL, triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), acknowledged BOOLEAN NOT NULL DEFAULT FALSE)`,
		`CREATE TABLE IF NOT EXISTS enrollment_tokens (id VARCHAR(64) PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text), organization_id VARCHAR(64) NOT NULL, token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_by_endpoint_id VARCHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`ALTER TABLE enrollment_tokens ALTER COLUMN id SET DEFAULT md5(random()::text || clock_timestamp()::text)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, organization_id VARCHAR(64) NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, outcome TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("prepare schema: %v", err)
		}
	}
	_, _ = db.Exec(`DELETE FROM audit_logs WHERE organization_id = 'org-integration'`)
	_, _ = db.Exec(`DELETE FROM enrollment_tokens WHERE organization_id = 'org-integration'`)
	_, _ = db.Exec(`DELETE FROM system_alerts WHERE organization_id = 'org-integration'`)
	_, _ = db.Exec(`DELETE FROM alert_rules WHERE organization_id = 'org-integration'`)
	_, _ = db.Exec(`DELETE FROM metrics_history WHERE endpoint_id IN ('ep-integration', 'ep-stale')`)
	_, _ = db.Exec(`DELETE FROM endpoints WHERE id IN ('ep-integration', 'ep-stale')`)
	_, err := db.Exec(`INSERT INTO endpoints (id, organization_id, hostname, serial_number, status, last_seen_at) VALUES ('ep-integration', 'org-integration', 'integration-host', 'serial-1', 'online', NOW()), ('ep-stale', 'org-integration', 'stale-host', 'serial-2', 'online', NOW() - INTERVAL '30 minutes')`)
	if err != nil {
		t.Fatalf("insert endpoints: %v", err)
	}
	_, err = db.Exec(`INSERT INTO alert_rules (id, organization_id, name, metric, condition, threshold_value, severity, enabled) VALUES ('rule-cpu', 'org-integration', 'CPU High', 'cpu', '>', 80, 'critical', TRUE)`)
	if err != nil {
		t.Fatalf("insert alert rule: %v", err)
	}
}

func TestLivePostgresRedisWorkerFlow(t *testing.T) {
	db := openIntegrationDB(t)
	defer db.Close()
	prepareWorkerSchema(t, db)

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6380/14"
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Skipf("Redis integration unavailable: %v", err)
	}
	client := redis.NewClient(options)
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		t.Skipf("Redis integration unavailable: %v", err)
	}
	defer client.Close()

	stream := "integration:sentinelpulse:telemetry"
	group := "integration:persistence"
	deadLetter := "integration:sentinelpulse:dead-letter"
	_, _ = client.Del(ctx, stream, deadLetter).Result()
	worker := NewRedisStreamWorker(client, "integration-worker")
	worker.streamName = stream
	worker.consumerGroup = group
	worker.deadLetter = deadLetter
	if err := worker.EnsureConsumerGroup(ctx); err != nil {
		t.Fatalf("ensure consumer group: %v", err)
	}

	processor := NewProductionTelemetryProcessor(db)
	high := TelemetryEnvelope{SchemaVersion: "1.0", EventID: "integration-high", EndpointID: "ep-integration", OrganizationID: "org-integration", CaptureTime: time.Now().UTC(), SequenceNo: 1, Module: "cpu", Payload: map[string]interface{}{"cpu_percent": 95, "ram_percent": 40}}
	if _, err := worker.Publish(ctx, high); err != nil {
		t.Fatalf("publish high telemetry: %v", err)
	}
	if _, err := processor.RunOnce(ctx, worker); err != nil {
		t.Fatalf("process high telemetry: %v", err)
	}

	var metricCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM metrics_history WHERE endpoint_id = 'ep-integration'`).Scan(&metricCount); err != nil || metricCount != 1 {
		t.Fatalf("expected persisted metric row, count=%d err=%v", metricCount, err)
	}
	var alertCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM system_alerts WHERE endpoint_id = 'ep-integration' AND acknowledged = FALSE`).Scan(&alertCount); err != nil || alertCount != 1 {
		t.Fatalf("expected opened alert, count=%d err=%v", alertCount, err)
	}

	low := high
	low.EventID = "integration-low"
	low.SequenceNo = 2
	low.CaptureTime = time.Now().UTC()
	low.Payload = map[string]interface{}{"cpu_percent": 20, "ram_percent": 40}
	if _, err := worker.Publish(ctx, low); err != nil {
		t.Fatalf("publish recovery telemetry: %v", err)
	}
	if _, err := processor.RunOnce(ctx, worker); err != nil {
		t.Fatalf("process recovery telemetry: %v", err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM system_alerts WHERE endpoint_id = 'ep-integration' AND acknowledged = FALSE`).Scan(&alertCount); err != nil || alertCount != 0 {
		t.Fatalf("expected alert to resolve, active count=%d err=%v", alertCount, err)
	}

	staleIDs, err := processor.CheckStaleOnce(ctx, time.Now().UTC())
	if err != nil || len(staleIDs) != 1 || staleIDs[0] != "ep-stale" {
		t.Fatalf("expected stale endpoint processing, ids=%v err=%v", staleIDs, err)
	}
	var status string
	if err := db.QueryRow(`SELECT status FROM endpoints WHERE id = 'ep-stale'`).Scan(&status); err != nil || status != "offline" {
		t.Fatalf("expected stale endpoint offline, status=%q err=%v", status, err)
	}
}


func TestLivePostgresRepositories(t *testing.T) {
	db := openIntegrationDB(t)
	defer db.Close()
	prepareWorkerSchema(t, db)

	audit := NewPersistentAuditRepository(db)
	if _, err := audit.Log("org-integration", "admin@integration", "TEST", "target", "SUCCESS"); err != nil {
		t.Fatalf("audit write failed: %v", err)
	}
	auditEntries, err := audit.List("org-integration")
	if err != nil || len(auditEntries) == 0 {
		t.Fatalf("audit read failed: entries=%v err=%v", auditEntries, err)
	}

	endpoints := NewEndpointRepository(db)
	if err := endpoints.UpsertEndpoint(EndpointModel{ID: "ep-repository", OrganizationID: "org-integration", Hostname: "repo-host", SerialNumber: "repo-serial", Status: "online", LastSeenAt: time.Now().UTC()}); err != nil {
		t.Fatalf("endpoint upsert failed: %v", err)
	}
	endpointRows, err := endpoints.ListEndpoints("org-integration")
	if err != nil || len(endpointRows) == 0 {
		t.Fatalf("endpoint list failed: rows=%v err=%v", endpointRows, err)
	}

	tokens := NewTokenRepository(db)
	rawToken := "integration-token-123"
	if _, err := tokens.CreateToken("org-integration", rawToken, time.Hour); err != nil {
		t.Fatalf("token create failed: %v", err)
	}
	consumed, err := tokens.ConsumeAndRegisterEndpoint(rawToken, "ep-token", "token-host", "token-serial")
	if err != nil || !consumed {
		t.Fatalf("token consume failed: consumed=%v err=%v", consumed, err)
	}
	consumedAgain, err := tokens.ConsumeAndRegisterEndpoint(rawToken, "ep-token-2", "token-host-2", "token-serial-2")
	if err == nil || consumedAgain {
		t.Fatalf("expected second token consume to fail: consumed=%v err=%v", consumedAgain, err)
	}
}
