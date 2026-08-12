package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"
)

type TelemetryPersistenceWorker struct {
	db *sql.DB
}

func NewTelemetryPersistenceWorker(db *sql.DB) *TelemetryPersistenceWorker {
	return &TelemetryPersistenceWorker{db: db}
}

func metricValue(payload map[string]interface{}, keys ...string) interface{} {
	for _, key := range keys {
		if value, ok := payload[key]; ok {
			switch typed := value.(type) {
			case float64:
				return typed
			case float32:
				return typed
			case int:
				return typed
			case int64:
				return typed
			case string:
				if parsed, err := strconv.ParseFloat(typed, 64); err == nil {
					return parsed
				}
			}
		}
	}
	return nil
}

func (w *TelemetryPersistenceWorker) PersistTelemetry(ctx context.Context, envelope TelemetryEnvelope) error {
	if w.db == nil {
		return errors.New("database connection is nil")
	}
	if err := (&StreamWorker{}).ValidateEnvelope(envelope); err != nil {
		return err
	}

	capturedAt := envelope.CaptureTime
	if capturedAt.IsZero() {
		capturedAt = time.Now().UTC()
	}
	cpu := metricValue(envelope.Payload, "cpu_usage_percent", "cpu_percent")
	ram := metricValue(envelope.Payload, "ram_usage_percent", "ram_percent")
	disk := metricValue(envelope.Payload, "disk_free_percent", "disk_percent_free")
	network := metricValue(envelope.Payload, "network_io_kbps", "network_kbps")

	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin telemetry persistence transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO metrics_history (captured_at, endpoint_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, network_io_kbps)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, capturedAt, envelope.EndpointID, cpu, ram, disk, network)
	if err != nil {
		return fmt.Errorf("insert metrics history: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE endpoints SET status = 'online', last_seen_at = $1
		WHERE id = $2 AND organization_id = $3
	`, capturedAt, envelope.EndpointID, envelope.OrganizationID)
	if err != nil {
		return fmt.Errorf("update endpoint heartbeat: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit telemetry persistence transaction: %w", err)
	}
	return nil
}

func (w *TelemetryPersistenceWorker) RunOnce(ctx context.Context, streamWorker *StreamWorker) (bool, error) {
	if streamWorker == nil {
		return false, errors.New("stream worker is nil")
	}
	return streamWorker.ReadAndProcessOnce(ctx, func(ctx context.Context, envelope TelemetryEnvelope) error {
		return w.PersistTelemetry(ctx, envelope)
	})
}
