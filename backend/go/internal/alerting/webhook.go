package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type AlertPayload struct {
	AlertID    string    `json:"alert_id"`
	EndpointID string    `json:"endpoint_id"`
	Severity   string    `json:"severity"`
	Message    string    `json:"message"`
	FiredAt    time.Time `json:"fired_at"`
}

func DispatchWebhook(webhookURL string, alert AlertPayload) error {
	if webhookURL == "" {
		return nil
	}

	body, err := json.Marshal(alert)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}
