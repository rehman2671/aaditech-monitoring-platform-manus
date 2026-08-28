package telemetry

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type Worker struct {
	db         *sql.DB
	rdb        *redis.Client
	streamName string
	groupName  string
	consumer   string
}

func NewWorker(db *sql.DB, rdb *redis.Client, streamName, groupName, consumer string) *Worker {
	return &Worker{
		db:         db,
		rdb:        rdb,
		streamName: streamName,
		groupName:  groupName,
		consumer:   consumer,
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

func isBusyGroupErr(err error) bool {
	return err != nil && (err.Error() == "BUSYGROUP Consumer Group name already exists" || len(err.Error()) > 8 && err.Error()[:8] == "BUSYGROUP")
}
