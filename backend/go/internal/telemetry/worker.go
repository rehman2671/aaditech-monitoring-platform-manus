package telemetry

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sentinelpulse/backend/internal/intelligence"
)

type processDiagnosticsPayload struct {
	Diagnostics struct {
		Processes struct {
			Status string              `json:"status"`
			Items  []processSampleJSON `json:"items"`
		} `json:"processes"`
	} `json:"diagnostics"`
}

type processSampleJSON struct {
	PID        int      `json:"pid"`
	Name       string   `json:"name"`
	CPUPercent *float64 `json:"cpu_percent"`
	RAMMb      *float64 `json:"ram_mb"`

	Username        string   `json:"username"`
	ExecutablePath  *string  `json:"executable_path"`
	CommandLine     *string  `json:"command_line"`
	Publisher       *string  `json:"publisher"`
	SignatureStatus *string  `json:"signature_status"`
	ExecutableHash  *string  `json:"executable_hash"`
	ParentPID       *int     `json:"parent_pid"`
	ParentName      *string  `json:"parent_name"`
	StartTime       *string  `json:"start_time"`
	CPUTimeSeconds  *float64 `json:"cpu_time_seconds"`
	PrivateMemoryMb *float64 `json:"private_memory_mb"`
	VirtualMemoryMb *float64 `json:"virtual_memory_mb"`
	ThreadCount     *int     `json:"thread_count"`
	HandleCount     *int     `json:"handle_count"`
	Priority        *int     `json:"priority"`
	IntegrityLevel  *string  `json:"integrity_level"`
	State           string   `json:"state"`
	Availability    string   `json:"availability"`
}

type Worker struct {
	db                   *sql.DB
	rdb                  *redis.Client
	streamName           string
	groupName            string
	consumer             string
	processRetentionDays int
}

func NewWorker(db *sql.DB, rdb *redis.Client, streamName, groupName, consumer string) *Worker {
	return NewWorkerWithRetention(db, rdb, streamName, groupName, consumer, 0)
}

func NewWorkerWithRetention(db *sql.DB, rdb *redis.Client, streamName, groupName, consumer string, processRetentionDays int) *Worker {
	if processRetentionDays < 0 {
		processRetentionDays = 0
	}
	return &Worker{
		db:                   db,
		rdb:                  rdb,
		streamName:           streamName,
		groupName:            groupName,
		consumer:             consumer,
		processRetentionDays: processRetentionDays,
	}
}

func (w *Worker) EnsureConsumerGroup(ctx context.Context) {
	err := w.rdb.XGroupCreateMkStream(ctx, w.streamName, w.groupName, "$").Err()
	if err != nil && !isBusyGroupErr(err) {
		log.Printf("[Worker] Notice creating consumer group: %v", err)
	}
}

func (w *Worker) Start(ctx context.Context) {
	w.EnsureConsumerGroup(ctx)
	log.Printf("[Worker] Starting Redis Streams consumer worker on group %s", w.groupName)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			streams, err := w.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    w.groupName,
				Consumer: w.consumer,
				Streams:  []string{w.streamName, ">"},
				Count:    10,
				Block:    2 * time.Second,
			}).Result()

			if err != nil {
				continue
			}

			for _, stream := range streams {
				for _, msg := range stream.Messages {
					if err := w.ProcessMessage(ctx, msg); err == nil {
						w.rdb.XAck(ctx, w.streamName, w.groupName, msg.ID)
					} else {
						log.Printf("[Worker] Failed to process message %s: %v. Retaining in pending list.", msg.ID, err)
					}
				}
			}
		}
	}
}

func (w *Worker) ProcessMessage(ctx context.Context, msg redis.XMessage) error {
	envelopeStr, ok := msg.Values["envelope"].(string)
	if !ok {
		return nil // skip malformed
	}

	var env TelemetryEnvelope
	if err := json.Unmarshal([]byte(envelopeStr), &env); err != nil {
		return err
	}
	if env.TenantID == "" || env.EndpointID == "" || env.CaptureTime == "" {
		return fmt.Errorf("telemetry envelope missing tenant_id, endpoint_id, or capture_time")
	}
	capturedAt, err := time.Parse(time.RFC3339Nano, env.CaptureTime)
	if err != nil {
		return fmt.Errorf("invalid capture_time: %w", err)
	}

	var metrics struct {
		CPU  *float64 `json:"cpu_utilization"`
		RAM  *float64 `json:"ram_utilization"`
		Disk *float64 `json:"disk_utilization"`
	}
	if err := json.Unmarshal(env.Payload, &metrics); err != nil {
		return fmt.Errorf("invalid telemetry payload: %w", err)
	}

	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Persist only values actually emitted by the collector; unavailable values remain NULL.
	_, err = tx.ExecContext(ctx, `
		INSERT INTO endpoint_metrics_hyper (tenant_id, endpoint_id, captured_at, cpu_utilization, ram_utilization, disk_utilization, payload_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id, endpoint_id, captured_at) DO NOTHING
	`, env.TenantID, env.EndpointID, capturedAt.UTC(), metrics.CPU, metrics.RAM, metrics.Disk, env.Payload)

	if err != nil {
		return err
	}

	if err := persistProcessSamples(ctx, tx, env, capturedAt.UTC()); err != nil {
		return err
	}
	if w.processRetentionDays > 0 {
		cutoff := capturedAt.UTC().Add(-time.Duration(w.processRetentionDays) * 24 * time.Hour)
		if _, err := tx.ExecContext(ctx, `
			DELETE FROM endpoint_process_samples
			WHERE tenant_id = $1 AND endpoint_id = $2 AND captured_at < $3
		`, env.TenantID, env.EndpointID, cutoff); err != nil {
			return fmt.Errorf("purge old process samples: %w", err)
		}
	}

	// Update only the endpoint belonging to the authenticated tenant.
	result, err := tx.ExecContext(ctx, `
		UPDATE endpoints
		SET status = 'online',
		    status_reason = 'Authenticated telemetry evidence received',
		    status_changed_at = CASE WHEN status IS DISTINCT FROM 'online' THEN $3 ELSE status_changed_at END,
		    last_seen = $3
		WHERE id = $1 AND tenant_id = $2
	`, env.EndpointID, env.TenantID, capturedAt.UTC())
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return err
		}
		return fmt.Errorf("endpoint %s is not registered in tenant %s", env.EndpointID, env.TenantID)
	}

	return tx.Commit()
}

func persistProcessSamples(ctx context.Context, tx *sql.Tx, env TelemetryEnvelope, capturedAt time.Time) error {
	var payload processDiagnosticsPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		return fmt.Errorf("invalid diagnostics payload: %w", err)
	}
	processes := payload.Diagnostics.Processes
	if !strings.EqualFold(processes.Status, "ok") || len(processes.Items) == 0 {
		return nil
	}

	for _, item := range processes.Items {
		if item.PID <= 0 || strings.TrimSpace(item.Name) == "" {
			continue
		}
		startTime := parseOptionalTime(item.StartTime)
		availability := normalizeAvailability(item.Availability)
		state := strings.TrimSpace(item.State)
		if state == "" {
			state = "unknown"
		}
		_, err := tx.ExecContext(ctx, `
			INSERT INTO endpoint_process_samples (
				tenant_id, endpoint_id, captured_at, pid, name,
				executable_path, command_line, publisher, signature, executable_hash,
				parent_pid, parent_name, start_time, user_session,
				cpu_percent, cpu_time_seconds, working_set_bytes, private_bytes, virtual_bytes,
				thread_count, handle_count, priority, integrity_level, state, availability, payload_json
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
			        $21, $22, $23, $24, $25, $26)
			ON CONFLICT (tenant_id, endpoint_id, captured_at, pid) DO NOTHING
		`, env.TenantID, env.EndpointID, capturedAt, item.PID, strings.TrimSpace(item.Name),
			item.ExecutablePath, item.CommandLine, item.Publisher, item.SignatureStatus, item.ExecutableHash,
			item.ParentPID, item.ParentName, startTime, item.Username,
			item.CPUPercent, item.CPUTimeSeconds, mbToBytes(item.RAMMb), mbToBytes(item.PrivateMemoryMb), mbToBytes(item.VirtualMemoryMb),
			item.ThreadCount, item.HandleCount, item.Priority, item.IntegrityLevel, state, availability, env.Payload)
		if err != nil {
			return fmt.Errorf("persist process sample pid %d: %w", item.PID, err)
		}
	}
	return nil
}

func parseOptionalTime(raw *string) *time.Time {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(*raw))
	if err != nil {
		return nil
	}
	parsed = parsed.UTC()
	return &parsed
}

func mbToBytes(mb *float64) *uint64 {
	if mb == nil || *mb < 0 || math.IsNaN(*mb) || math.IsInf(*mb, 0) {
		return nil
	}
	bytes := math.Round(*mb * 1024 * 1024)
	if bytes > math.MaxInt64 {
		return nil
	}
	value := uint64(bytes)
	return &value
}

func normalizeAvailability(raw string) intelligence.EvidenceAvailability {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case string(intelligence.EvidenceObserved):
		return intelligence.EvidenceObserved
	case string(intelligence.EvidenceUnavailable):
		return intelligence.EvidenceUnavailable
	case string(intelligence.EvidenceInsufficient):
		return intelligence.EvidenceInsufficient
	default:
		return intelligence.EvidenceUnknown
	}
}

func isBusyGroupErr(err error) bool {
	return err != nil && (err.Error() == "BUSYGROUP Consumer Group name already exists" || len(err.Error()) > 8 && err.Error()[:8] == "BUSYGROUP")
}
