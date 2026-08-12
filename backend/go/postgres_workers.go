package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

type PostgresAlertSink struct {
	db *sql.DB
}

func NewPostgresAlertSink(db *sql.DB) *PostgresAlertSink {
	return &PostgresAlertSink{db: db}
}

func alertRecordID(event AlertEventModel) string {
	hash := sha256.Sum256([]byte(event.AlertKey + event.OccurredAt.UTC().Format(time.RFC3339Nano)))
	return "alert-" + hex.EncodeToString(hash[:])[:56]
}

func (s *PostgresAlertSink) EmitAlert(ctx context.Context, event AlertEventModel) error {
	if s.db == nil {
		return errors.New("database connection is nil")
	}

	if event.Type == "resolved" {
		_, err := s.db.ExecContext(ctx, `
			UPDATE system_alerts
			SET acknowledged = TRUE
			WHERE organization_id = $1 AND endpoint_id = $2 AND rule_name = $3 AND acknowledged = FALSE
		`, event.OrganizationID, event.EndpointID, event.RuleName)
		if err != nil {
			return fmt.Errorf("resolve system alert: %w", err)
		}
		return nil
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO system_alerts
			(id, organization_id, endpoint_id, hostname, rule_name, severity, message, triggered_at, acknowledged)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
	`, alertRecordID(event), event.OrganizationID, event.EndpointID, event.EndpointID, event.RuleName, event.Severity, event.Reason, event.OccurredAt.UTC())
	if err != nil {
		return fmt.Errorf("persist system alert: %w", err)
	}
	return nil
}

type PostgresHeartbeatSink struct {
	db *sql.DB
}

func NewPostgresHeartbeatSink(db *sql.DB) *PostgresHeartbeatSink {
	return &PostgresHeartbeatSink{db: db}
}

func (s *PostgresHeartbeatSink) MarkEndpointStale(ctx context.Context, endpointID string, lastSeenAt time.Time) error {
	if s.db == nil {
		return errors.New("database connection is nil")
	}
	_, err := s.db.ExecContext(ctx, `
		UPDATE endpoints
		SET status = 'offline'
		WHERE id = $1 AND last_seen_at <= $2
	`, endpointID, lastSeenAt)
	if err != nil {
		return fmt.Errorf("mark endpoint stale: %w", err)
	}
	return nil
}

type PostgresAlertRuleRepository struct {
	db *sql.DB
}

func NewPostgresAlertRuleRepository(db *sql.DB) *PostgresAlertRuleRepository {
	return &PostgresAlertRuleRepository{db: db}
}

func (r *PostgresAlertRuleRepository) ListEnabled(ctx context.Context, orgID string) ([]AlertRuleModel, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, organization_id, name, metric, condition, threshold_value, severity, enabled
		FROM alert_rules WHERE organization_id = $1 AND enabled = TRUE
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("load alert rules: %w", err)
	}
	defer rows.Close()

	var rules []AlertRuleModel
	for rows.Next() {
		var rule AlertRuleModel
		if err := rows.Scan(&rule.ID, &rule.OrganizationID, &rule.Name, &rule.Metric, &rule.Condition, &rule.Threshold, &rule.Severity, &rule.Enabled); err != nil {
			return nil, fmt.Errorf("scan alert rule: %w", err)
		}
		rules = append(rules, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return rules, nil
}

type ProductionTelemetryProcessor struct {
	persistence *TelemetryPersistenceWorker
	rules       *PostgresAlertRuleRepository
	alerts      *AlertHeartbeatWorker
}

func NewProductionTelemetryProcessor(db *sql.DB) *ProductionTelemetryProcessor {
	return &ProductionTelemetryProcessor{
		persistence: NewTelemetryPersistenceWorker(db),
		rules:       NewPostgresAlertRuleRepository(db),
		alerts: NewAlertHeartbeatWorker(
			NewPostgresAlertSink(db),
			NewPostgresHeartbeatSink(db),
			15*time.Minute,
		),
	}
}

func (p *ProductionTelemetryProcessor) Process(ctx context.Context, envelope TelemetryEnvelope) error {
	if p.persistence == nil || p.rules == nil || p.alerts == nil {
		return errors.New("production telemetry processor is not configured")
	}
	if err := p.persistence.PersistTelemetry(ctx, envelope); err != nil {
		return err
	}

	rules, err := p.rules.ListEnabled(ctx, envelope.OrganizationID)
	if err != nil {
		return err
	}
	values := map[AlertMetric]float64{}
	for _, metric := range []struct {
		key  AlertMetric
		keys []string
	}{
		{MetricCPU, []string{"cpu_usage_percent", "cpu_percent"}},
		{MetricRAM, []string{"ram_usage_percent", "ram_percent"}},
		{MetricDiskFree, []string{"disk_free_percent", "disk_percent_free"}},
		{MetricNetworkLatency, []string{"network_latency_ms", "latency_ms"}},
		{MetricBatteryHealth, []string{"battery_health_percent"}},
	} {
		if value := metricValue(envelope.Payload, metric.keys...); value != nil {
			if numeric, ok := value.(float64); ok {
				values[metric.key] = numeric
			}
		}
	}
	return p.alerts.EvaluateAndEmit(ctx, envelope.EndpointID, envelope.OrganizationID, values, rules, envelope.CaptureTime)
}

func (p *ProductionTelemetryProcessor) RunOnce(ctx context.Context, streamWorker *StreamWorker) (bool, error) {
	if streamWorker == nil {
		return false, errors.New("stream worker is nil")
	}
	return streamWorker.ReadAndProcessOnce(ctx, func(ctx context.Context, envelope TelemetryEnvelope) error {
		return p.Process(ctx, envelope)
	})
}


func (p *ProductionTelemetryProcessor) CheckStaleOnce(ctx context.Context, now time.Time) ([]string, error) {
	if p == nil || p.alerts == nil || p.alerts.heartbeatSink == nil {
		return nil, errors.New("production heartbeat processor is not configured")
	}
	if p.persistence == nil || p.persistence.db == nil {
		return nil, errors.New("database connection is nil")
	}

	rows, err := p.persistence.db.QueryContext(ctx, `
		SELECT id, last_seen_at, status FROM endpoints
		WHERE status <> 'disabled' AND last_seen_at IS NOT NULL
	`)
	if err != nil {
		return nil, fmt.Errorf("load endpoint heartbeat states: %w", err)
	}
	defer rows.Close()

	var states []HeartbeatState
	for rows.Next() {
		var state HeartbeatState
		if err := rows.Scan(&state.EndpointID, &state.LastSeenAt, &state.Status); err != nil {
			return nil, fmt.Errorf("scan endpoint heartbeat state: %w", err)
		}
		states = append(states, state)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return p.alerts.CheckStale(ctx, states, now)
}
