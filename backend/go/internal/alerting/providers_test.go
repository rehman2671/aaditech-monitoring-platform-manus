package alerting

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestDispatchAlert_Slack(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		var payload SlackPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("Failed to decode Slack payload: %v", err)
		}
		if payload.Text == "" {
			t.Errorf("Expected non-empty Slack text payload")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := WebhookConfig{
		URL:      server.URL,
		Provider: ProviderSlack,
	}
	alert := AlertPayload{
		AlertID:    "alt-1",
		EndpointID: "ws-corp-01",
		Severity:   "CRITICAL",
		Message:    "High CPU usage",
		FiredAt:    time.Now(),
	}

	err := DispatchAlert(cfg, alert)
	if err != nil {
		t.Errorf("Expected no error dispatching Slack alert, got %v", err)
	}
}

func TestDispatchAlert_PagerDuty(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload PagerDutyPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("Failed to decode PagerDuty payload: %v", err)
		}
		if payload.EventAction != "trigger" {
			t.Errorf("Expected event_action 'trigger', got %s", payload.EventAction)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	cfg := WebhookConfig{
		URL:      server.URL,
		Provider: ProviderPagerDuty,
	}
	alert := AlertPayload{
		AlertID:    "alt-2",
		EndpointID: "ws-corp-02",
		Severity:   "WARNING",
		Message:    "Low disk space",
		FiredAt:    time.Now(),
	}

	err := DispatchAlert(cfg, alert)
	if err != nil {
		t.Errorf("Expected no error dispatching PagerDuty alert, got %v", err)
	}
}
