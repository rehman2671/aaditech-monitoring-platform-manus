package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type AlertMetric string

const (
	MetricCPU             AlertMetric = "cpu"
	MetricRAM             AlertMetric = "ram"
	MetricDiskFree        AlertMetric = "disk_free"
	MetricBatteryHealth   AlertMetric = "battery_health"
	MetricNetworkLatency  AlertMetric = "network_latency"
	MetricOffline         AlertMetric = "offline"
)

type AlertRuleModel struct {
	ID              string
	OrganizationID  string
	Name            string
	Metric          AlertMetric
	Condition       string
	Threshold       float64
	Severity        string
	Enabled         bool
	DurationMinutes int
}

type AlertEventModel struct {
	Type           string    `json:"type"`
	AlertKey       string    `json:"alert_key"`
	EndpointID     string    `json:"endpoint_id"`
	OrganizationID string    `json:"organization_id"`
	RuleID         string    `json:"rule_id"`
	RuleName       string    `json:"rule_name"`
	Metric         AlertMetric `json:"metric"`
	Value          float64   `json:"value"`
	Threshold      float64   `json:"threshold"`
	Severity       string    `json:"severity"`
	OccurredAt     time.Time `json:"occurred_at"`
	Reason         string    `json:"reason"`
}

func EvaluateAlertRules(endpointID, organizationID string, values map[AlertMetric]float64, rules []AlertRuleModel, now time.Time) []AlertEventModel {
	var events []AlertEventModel
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		value, ok := values[rule.Metric]
		if !ok {
			continue
		}
		breached := (rule.Condition == ">" && value > rule.Threshold) || (rule.Condition == "<" && value < rule.Threshold)
		if rule.Condition != ">" && rule.Condition != "<" {
			continue
		}
		eventType := "resolved"
		reason := fmt.Sprintf("%s returned within threshold", rule.Metric)
		if breached {
			eventType = "opened"
			reason = fmt.Sprintf("%s %s %.2f", rule.Metric, rule.Condition, rule.Threshold)
		}
		events = append(events, AlertEventModel{
			Type:           eventType,
			AlertKey:       endpointID + ":" + rule.ID,
			EndpointID:     endpointID,
			OrganizationID: organizationID,
			RuleID:         rule.ID,
			RuleName:       rule.Name,
			Metric:         rule.Metric,
			Value:          value,
			Threshold:      rule.Threshold,
			Severity:       rule.Severity,
			OccurredAt:     now.UTC(),
			Reason:         reason,
		})
	}
	return events
}

type HeartbeatState struct {
	EndpointID string
	LastSeenAt time.Time
	Status     string
}

type AlertSink interface {
	EmitAlert(context.Context, AlertEventModel) error
}

type HeartbeatSink interface {
	MarkEndpointStale(context.Context, string, time.Time) error
}

type AlertHeartbeatWorker struct {
	alertSink     AlertSink
	heartbeatSink HeartbeatSink
	staleAfter    time.Duration
}

func NewAlertHeartbeatWorker(alertSink AlertSink, heartbeatSink HeartbeatSink, staleAfter time.Duration) *AlertHeartbeatWorker {
	if staleAfter <= 0 {
		staleAfter = 15 * time.Minute
	}
	return &AlertHeartbeatWorker{alertSink: alertSink, heartbeatSink: heartbeatSink, staleAfter: staleAfter}
}

func (w *AlertHeartbeatWorker) EvaluateAndEmit(ctx context.Context, endpointID, organizationID string, values map[AlertMetric]float64, rules []AlertRuleModel, now time.Time) error {
	if w.alertSink == nil {
		return errors.New("alert sink is nil")
	}
	for _, event := range EvaluateAlertRules(endpointID, organizationID, values, rules, now) {
		if err := w.alertSink.EmitAlert(ctx, event); err != nil {
			return err
		}
	}
	return nil
}

func (w *AlertHeartbeatWorker) CheckStale(ctx context.Context, states []HeartbeatState, now time.Time) ([]string, error) {
	if w.heartbeatSink == nil {
		return nil, errors.New("heartbeat sink is nil")
	}
	cutoff := now.UTC().Add(-w.staleAfter)
	var stale []string
	for _, state := range states {
		if state.Status == "stale" || state.LastSeenAt.Before(cutoff) {
			if err := w.heartbeatSink.MarkEndpointStale(ctx, state.EndpointID, state.LastSeenAt); err != nil {
				return stale, err
			}
			stale = append(stale, state.EndpointID)
		}
	}
	return stale, nil
}
