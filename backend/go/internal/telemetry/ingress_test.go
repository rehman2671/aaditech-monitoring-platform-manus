package telemetry

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func telemetryRequest(body string, identity *DeviceIdentity) (*httptest.ResponseRecorder, *http.Request) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry", strings.NewReader(body))
	if identity != nil {
		req = req.WithContext(WithDeviceIdentity(req.Context(), *identity))
	}
	return httptest.NewRecorder(), req
}

func TestTelemetryIngestRequiresDeviceIdentity(t *testing.T) {
	redisServer, err := miniredis.Run()
	if err != nil {
		t.Fatal(err)
	}
	defer redisServer.Close()
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	defer client.Close()

	res, req := telemetryRequest(`{"event_id":"event-1","endpoint_id":"endpoint-1","capture_time":"2026-08-25T00:00:00Z","payload":{}}`, nil)
	HandleTelemetryIngest(client, "telemetry").ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestTelemetryIngestRejectsMismatchedEndpoint(t *testing.T) {
	redisServer, err := miniredis.Run()
	if err != nil {
		t.Fatal(err)
	}
	defer redisServer.Close()
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	defer client.Close()

	res, req := telemetryRequest(`{"event_id":"event-1","endpoint_id":"other-endpoint","capture_time":"2026-08-25T00:00:00Z","payload":{}}`, &DeviceIdentity{EndpointID: "endpoint-1", TenantID: "tenant-1"})
	HandleTelemetryIngest(client, "telemetry").ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.Code)
	}
}

func TestTelemetryIngestEnrichesTenantAndQueuesEnvelope(t *testing.T) {
	redisServer, err := miniredis.Run()
	if err != nil {
		t.Fatal(err)
	}
	defer redisServer.Close()
	client := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	defer client.Close()

	res, req := telemetryRequest(`{"schema_version":"1.0","event_id":"event-1","endpoint_id":"endpoint-1","sequence_number":7,"capture_time":"2026-08-25T00:00:00Z","module":"system","payload":{"cpu_utilization":12.5}}`, &DeviceIdentity{EndpointID: "endpoint-1", TenantID: "tenant-1"})
	HandleTelemetryIngest(client, "telemetry").ServeHTTP(res, req)
	if res.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", res.Code, res.Body.String())
	}

	messages, err := client.XRange(req.Context(), "telemetry", "-", "+").Result()
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 1 {
		t.Fatalf("expected one queued message, got %d", len(messages))
	}
	envelope := messages[0].Values["envelope"].(string)
	var decoded TelemetryEnvelope
	if err := json.Unmarshal([]byte(envelope), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.TenantID != "tenant-1" || decoded.EndpointID != "endpoint-1" {
		t.Fatalf("unexpected enriched envelope: %#v", decoded)
	}
}
