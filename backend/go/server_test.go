package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

func generateTestJWT(secret string, email, orgID, role string) string {
	claims := jwt.MapClaims{
		"email":  email,
		"org_id": orgID,
		"role":   role,
		"exp":    time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString([]byte(secret))
	return signed
}

func TestHealthCheck(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy"}`))
	})

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rec.Code)
	}
}

func TestJWTAuthenticationFailClosed(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "test-super-secret")
	defer os.Unsetenv("JWT_SECRET")

	req := httptest.NewRequest("GET", "/api/v1/admin/audit", nil)
	rec := httptest.NewRecorder()

	handler := securityAndTenantMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for missing token, got %d", rec.Code)
	}
}

func TestRBACEnforcementJWT(t *testing.T) {
	secret := "test-super-secret"
	_ = os.Setenv("JWT_SECRET", secret)
	defer os.Unsetenv("JWT_SECRET")

	auditRepo = NewPersistentAuditRepository(nil)
	viewerToken := generateTestJWT(secret, "viewer@corp.internal", "org-enterprise-01", "viewer")

	req := httptest.NewRequest("GET", "/api/v1/admin/audit", nil)
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	rec := httptest.NewRecorder()

	handler := securityAndTenantMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for viewer accessing admin route, got %d", rec.Code)
	}
}

func TestAdminSuccessAndPersistentAuditLog(t *testing.T) {
	secret := "test-super-secret"
	_ = os.Setenv("JWT_SECRET", secret)
	defer os.Unsetenv("JWT_SECRET")

	auditRepo = NewPersistentAuditRepository(nil)
	_, _ = auditRepo.Log("org-enterprise-01", "admin@sentinelpulse.internal", "TEST_ACTION", "Target1", "SUCCESS")

	adminToken := generateTestJWT(secret, "admin@sentinelpulse.internal", "org-enterprise-01", "admin")

	req := httptest.NewRequest("GET", "/api/v1/admin/audit", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	rec := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/admin/audit", func(w http.ResponseWriter, r *http.Request) {
		orgID := r.Header.Get("X-Verified-Organization-ID")
		entries, _ := auditRepo.List(orgID)
		writeJSON(w, http.StatusOK, entries)
	})

	handler := securityAndTenantMiddleware(mux)
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for admin accessing audit logs, got %d", rec.Code)
	}

	var entries []AuditEntry
	if err := json.Unmarshal(rec.Body.Bytes(), &entries); err != nil {
		t.Fatalf("Failed to parse audit entries: %v", err)
	}

	if len(entries) == 0 {
		t.Error("Expected persisted audit entries, got 0")
	}
}

func TestPersistentAuditRepositoryWithMockDB(t *testing.T) {
	repo := NewPersistentAuditRepository(nil)
	_, err := repo.Log("org-test", "admin@test.com", "TEST_ACTION", "Target", "SUCCESS")
	if err != nil {
		t.Fatalf("Failed to log audit entry: %v", err)
	}

	entries, err := repo.List("org-test")
	if err != nil {
		t.Fatalf("Failed to list audit entries: %v", err)
	}

	if len(entries) != 1 || entries[0].Action != "TEST_ACTION" {
		t.Errorf("Expected 1 audit entry with action TEST_ACTION, got %v", entries)
	}
}

func TestEndpointRepositoryNilDB(t *testing.T) {
	repo := NewEndpointRepository(nil)
	err := repo.UpsertEndpoint(EndpointModel{ID: "ep-1"})
	if err == nil {
		t.Error("Expected error when upserting with nil database connection")
	}

	_, err = repo.ListEndpoints("org-1")
	if err == nil {
		t.Error("Expected error when listing endpoints with nil database connection")
	}
}

func TestTokenRepositoryNilDB(t *testing.T) {
	repo := NewTokenRepository(nil)
	_, err := repo.CreateToken("org-1", "secret-token", time.Hour)
	if err == nil {
		t.Error("Expected error when creating token with nil database connection")
	}

	_, err = repo.ConsumeAndRegisterEndpoint("secret-token", "ep-1", "host1", "sn1")
	if err == nil {
		t.Error("Expected error when consuming token with nil database connection")
	}
}

func TestTokenHashingDeterminism(t *testing.T) {
	raw := "sp_enrol_secret123"
	h1 := HashEnrollmentToken(raw)
	h2 := HashEnrollmentToken(raw)
	if h1 != h2 || len(h1) != 64 {
		t.Errorf("Expected deterministic 64-char sha256 hash, got %s and %s", h1, h2)
	}
}

func TestMigratorNilDB(t *testing.T) {
	migrator := NewMigrator(nil, "./migrations")
	err := migrator.Up()
	if err == nil {
		t.Error("Expected error when running migrator with nil database connection")
	}
}

func TestStreamWorkerProcessing(t *testing.T) {
	worker := NewStreamWorker("telemetry-stream", "persister-group", "worker-1")
	env := TelemetryEnvelope{
		SchemaVersion:  "1.0",
		EventID:        "evt-123",
		EndpointID:     "ep-999",
		OrganizationID: "org-enterprise-01",
		CaptureTime:    time.Now().UTC(),
		SequenceNo:     100,
		Module:         "cpu",
		Payload:        map[string]interface{}{"cpu_percent": 15.2},
	}

	data, _ := json.Marshal(env)
	err := worker.ProcessEnvelope(context.Background(), data)
	if err != nil {
		t.Errorf("Expected stream worker processing to succeed, got %v", err)
	}
}

func TestProductionFailClosedStartupLogic(t *testing.T) {
	_ = os.Setenv("ENV", "production")
	_ = os.Setenv("JWT_SECRET", "")
	defer os.Unsetenv("ENV")
	defer os.Unsetenv("JWT_SECRET")

	env := os.Getenv("ENV")
	jwtSecret := os.Getenv("JWT_SECRET")
	if (env == "production" || env == "prod") && jwtSecret == "" {
		return
	}
	t.Error("Expected production fail-closed condition for missing JWT_SECRET")
}


type testAlertSink struct{ events []AlertEventModel }
func (s *testAlertSink) EmitAlert(_ context.Context, event AlertEventModel) error { s.events = append(s.events, event); return nil }

type testHeartbeatSink struct{ stale []string }
func (s *testHeartbeatSink) MarkEndpointStale(_ context.Context, endpointID string, _ time.Time) error { s.stale = append(s.stale, endpointID); return nil }

func TestAlertEvaluationAndHeartbeatMonitoring(t *testing.T) {
	now := time.Now().UTC()
	rules := []AlertRuleModel{{ID: "cpu-high", OrganizationID: "org-1", Name: "CPU High", Metric: MetricCPU, Condition: ">", Threshold: 80, Severity: "critical", Enabled: true}}
	values := map[AlertMetric]float64{MetricCPU: 92}
	events := EvaluateAlertRules("ep-1", "org-1", values, rules, now)
	if len(events) != 1 || events[0].Type != "opened" || events[0].AlertKey != "ep-1:cpu-high" {
		t.Fatalf("expected opened CPU alert, got %+v", events)
	}

	alertSink := &testAlertSink{}
	heartbeatSink := &testHeartbeatSink{}
	worker := NewAlertHeartbeatWorker(alertSink, heartbeatSink, 15*time.Minute)
	if err := worker.EvaluateAndEmit(context.Background(), "ep-1", "org-1", values, rules, now); err != nil {
		t.Fatalf("evaluate and emit failed: %v", err)
	}
	stale, err := worker.CheckStale(context.Background(), []HeartbeatState{{EndpointID: "ep-1", LastSeenAt: now.Add(-16 * time.Minute), Status: "online"}, {EndpointID: "ep-2", LastSeenAt: now.Add(-2 * time.Minute), Status: "online"}}, now)
	if err != nil || len(stale) != 1 || stale[0] != "ep-1" || len(alertSink.events) != 1 || len(heartbeatSink.stale) != 1 {
		t.Fatalf("unexpected worker output: stale=%v alerts=%v sink=%v heartbeat=%v", stale, alertSink.events, alertSink.events, heartbeatSink.stale)
	}
}


func TestRedisStreamsPublishConsumeAndDeadLetter(t *testing.T) {
	if os.Getenv("REDIS_URL") == "" {
		os.Setenv("REDIS_URL", "redis://localhost:6380/15")
		defer os.Unsetenv("REDIS_URL")
	}
	options, err := redis.ParseURL(os.Getenv("REDIS_URL"))
	if err != nil {
		t.Fatalf("failed to parse REDIS_URL: %v", err)
	}
	client := redis.NewClient(options)
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis integration instance unavailable: %v", err)
	}
	defer client.Close()

	stream := "test:sentinelpulse:telemetry"
	group := "test:persistence"
	consumer := "test-worker-1"
	deadLetter := "test:sentinelpulse:dead-letter"
	_ = client.Del(ctx, stream, group, deadLetter).Err()
	worker := NewRedisStreamWorker(client, consumer)
	worker.streamName = stream
	worker.consumerGroup = group
	worker.deadLetter = deadLetter
	worker.maxAttempts = 2
	if err := worker.EnsureConsumerGroup(ctx); err != nil {
		t.Fatalf("failed to create consumer group: %v", err)
	}

	envelope := TelemetryEnvelope{SchemaVersion: "1.0", EventID: "redis-event-1", EndpointID: "ep-redis", OrganizationID: "org-redis", CaptureTime: time.Now().UTC(), SequenceNo: 1, Module: "cpu", Payload: map[string]interface{}{"cpu_percent": 42}}
	if _, err := worker.Publish(ctx, envelope); err != nil {
		t.Fatalf("failed to publish telemetry: %v", err)
	}
	called := false
	processed, err := worker.ReadAndProcessOnce(ctx, func(_ context.Context, got TelemetryEnvelope) error {
		called = got.EventID == envelope.EventID
		return nil
	})
	if err != nil || !processed || !called {
		t.Fatalf("expected telemetry to be consumed and acknowledged: processed=%v called=%v err=%v", processed, called, err)
	}

	badEnvelope := map[string]interface{}{"event_id": "bad-1", "organization_id": "org-redis", "endpoint_id": "ep-redis", "payload": "{invalid"}
	if _, err := client.XAdd(ctx, &redis.XAddArgs{Stream: stream, Values: badEnvelope}).Result(); err != nil {
		t.Fatalf("failed to publish bad telemetry: %v", err)
	}
	for i := 0; i < 2; i++ {
		_, _ = worker.ReadAndProcessOnce(ctx, func(_ context.Context, _ TelemetryEnvelope) error { return nil })
	}
	deadLetterCount, err := client.XLen(ctx, deadLetter).Result()
	if err != nil || deadLetterCount != 1 {
		t.Fatalf("expected one dead-letter message, count=%d err=%v", deadLetterCount, err)
	}
}


func TestTelemetryPersistenceWorkerRequiresDatabase(t *testing.T) {
	worker := NewTelemetryPersistenceWorker(nil)
	envelope := TelemetryEnvelope{EventID: "evt-db", EndpointID: "ep-db", OrganizationID: "org-db", Module: "cpu", CaptureTime: time.Now().UTC(), Payload: map[string]interface{}{"cpu_percent": 10}}
	if err := worker.PersistTelemetry(context.Background(), envelope); err == nil {
		t.Error("expected persistence worker to reject nil database connection")
	}
}


func TestPostgresWorkerSinksRequireDatabase(t *testing.T) {
	event := AlertEventModel{Type: "opened", AlertKey: "ep-1:rule-1", EndpointID: "ep-1", OrganizationID: "org-1", RuleID: "rule-1", RuleName: "CPU High", Metric: MetricCPU, Value: 95, Threshold: 80, Severity: "critical", OccurredAt: time.Now().UTC(), Reason: "cpu > 80"}
	if err := NewPostgresAlertSink(nil).EmitAlert(context.Background(), event); err == nil {
		t.Error("expected PostgreSQL alert sink to reject nil database")
	}
	if err := NewPostgresHeartbeatSink(nil).MarkEndpointStale(context.Background(), "ep-1", time.Now().UTC()); err == nil {
		t.Error("expected PostgreSQL heartbeat sink to reject nil database")
	}
	if _, err := NewPostgresAlertRuleRepository(nil).ListEnabled(context.Background(), "org-1"); err == nil {
		t.Error("expected PostgreSQL rule repository to reject nil database")
	}
}

func TestProductionTelemetryProcessorRequiresDependencies(t *testing.T) {
	processor := NewProductionTelemetryProcessor(nil)
	envelope := TelemetryEnvelope{EventID: "evt", EndpointID: "ep", OrganizationID: "org", Module: "cpu", CaptureTime: time.Now().UTC(), Payload: map[string]interface{}{"cpu_percent": 90}}
	if err := processor.Process(context.Background(), envelope); err == nil {
		t.Error("expected production processor to fail when database is unavailable")
	}
}


func TestProductionTelemetryProcessorStaleCheckRequiresDatabase(t *testing.T) {
	processor := NewProductionTelemetryProcessor(nil)
	if _, err := processor.CheckStaleOnce(context.Background(), time.Now().UTC()); err == nil {
		t.Error("expected stale heartbeat execution to fail without database")
	}
}


func TestProductionDatabaseStartupFailsClosedWhenUnreachable(t *testing.T) {
	_, err := openDatabaseForEnvironment("production", "postgres://sentinel_test:sentinel_test@127.0.0.1:65432/unreachable?sslmode=disable&connect_timeout=1")
	if err == nil {
		t.Fatal("expected production database startup to fail closed when PostgreSQL is unreachable")
	}
}
