package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ProviderType string

const (
	ProviderGeneric   ProviderType = "generic"
	ProviderSlack     ProviderType = "slack"
	ProviderPagerDuty ProviderType = "pagerduty"
)

type WebhookConfig struct {
	URL      string       `json:"url"`
	Provider ProviderType `json:"provider"`
}

type SlackPayload struct {
	Text string `json:"text"`
}

type PagerDutyPayload struct {
	RoutingKey  string `json:"routing_key"`
	EventAction string `json:"event_action"`
	Payload     struct {
		Summary   string `json:"summary"`
		Severity  string `json:"severity"`
		Source    string `json:"source"`
		Timestamp string `json:"timestamp"`
	} `json:"payload"`
}

func DispatchAlert(cfg WebhookConfig, alert AlertPayload) error {
	if cfg.URL == "" {
		return nil
	}

	var payload interface{}
	switch cfg.Provider {
	case ProviderSlack:
		payload = SlackPayload{
			Text: fmt.Sprintf(":rotating_light: *SentinelPulse Alert [%s]*\n*Endpoint:* `%s`\n*Message:* %s", alert.Severity, alert.EndpointID, alert.Message),
		}
	case ProviderPagerDuty:
		sev := "error"
		if alert.Severity == "WARNING" {
			sev = "warning"
		}
		pd := PagerDutyPayload{}
		pd.EventAction = "trigger"
		pd.Payload.Summary = alert.Message
		pd.Payload.Severity = sev
		pd.Payload.Source = alert.EndpointID
		pd.Payload.Timestamp = alert.FiredAt.Format(time.RFC3339)
		payload = pd
	default:
		payload = alert
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	var lastErr error
	client := &http.Client{Timeout: 5 * time.Second}

	for attempt := 1; attempt <= 3; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewBuffer(body))
		if err != nil {
			cancel()
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		cancel()
		if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
			resp.Body.Close()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		lastErr = fmt.Errorf("dispatch attempt %d failed with status %v", attempt, err)
		time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
	}

	return lastErr
}
