package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	TelemetryStreamName = "sentinelpulse:telemetry"
	TelemetryGroupName  = "sentinelpulse:persistence"
	TelemetryDLQName    = "sentinelpulse:telemetry:dead-letter"
	DefaultMaxAttempts  = 5
)

type TelemetryEnvelope struct {
	SchemaVersion  string                 `json:"schema_version"`
	EventID        string                 `json:"event_id"`
	EndpointID     string                 `json:"endpoint_id"`
	OrganizationID  string                 `json:"organization_id"`
	CaptureTime    time.Time              `json:"capture_time"`
	SequenceNo     int64                  `json:"sequence_number"`
	Module         string                 `json:"module"`
	Payload        map[string]interface{} `json:"payload"`
}

type StreamWorker struct {
	client        *redis.Client
	streamName    string
	consumerGroup string
	consumerName  string
	deadLetter    string
	maxAttempts   int
}

func NewStreamWorker(streamName, consumerGroup, consumerName string) *StreamWorker {
	return &StreamWorker{
		streamName:    streamName,
		consumerGroup: consumerGroup,
		consumerName:  consumerName,
		deadLetter:    TelemetryDLQName,
		maxAttempts:   DefaultMaxAttempts,
	}
}

func NewRedisStreamWorker(client *redis.Client, consumerName string) *StreamWorker {
	return &StreamWorker{
		client:        client,
		streamName:    TelemetryStreamName,
		consumerGroup: TelemetryGroupName,
		consumerName:  consumerName,
		deadLetter:    TelemetryDLQName,
		maxAttempts:   DefaultMaxAttempts,
	}
}

func (w *StreamWorker) ValidateEnvelope(envelope TelemetryEnvelope) error {
	if envelope.EventID == "" {
		return errors.New("event_id is required")
	}
	if envelope.EndpointID == "" {
		return errors.New("endpoint_id is required")
	}
	if envelope.OrganizationID == "" {
		return errors.New("organization_id is required")
	}
	if envelope.Module == "" {
		return errors.New("module is required")
	}
	if envelope.Payload == nil {
		return errors.New("payload is required")
	}
	return nil
}

func (w *StreamWorker) EnsureConsumerGroup(ctx context.Context) error {
	if w.client == nil {
		return errors.New("redis client is nil")
	}
	err := w.client.XGroupCreateMkStream(ctx, w.streamName, w.consumerGroup, "$").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("create redis consumer group: %w", err)
	}
	return nil
}

func (w *StreamWorker) Publish(ctx context.Context, envelope TelemetryEnvelope) (string, error) {
	if err := w.ValidateEnvelope(envelope); err != nil {
		return "", err
	}
	if w.client == nil {
		return "", errors.New("redis client is nil")
	}
	payload, err := json.Marshal(envelope)
	if err != nil {
		return "", fmt.Errorf("marshal telemetry envelope: %w", err)
	}

	return w.client.XAdd(ctx, &redis.XAddArgs{
		Stream: w.streamName,
		Values: map[string]interface{}{
			"event_id":       envelope.EventID,
			"organization_id": envelope.OrganizationID,
			"endpoint_id":    envelope.EndpointID,
			"payload":        string(payload),
			"attempt":        0,
		},
	}).Result()
}

func (w *StreamWorker) ProcessEnvelope(ctx context.Context, data []byte) error {
	var envelope TelemetryEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		log.Printf("[StreamWorker] Error unmarshaling telemetry envelope: %v", err)
		return err
	}
	if err := w.ValidateEnvelope(envelope); err != nil {
		return err
	}

	log.Printf("[StreamWorker] Processed telemetry for endpoint %s [module: %s, seq: %d]", envelope.EndpointID, envelope.Module, envelope.SequenceNo)
	return nil
}

func (w *StreamWorker) ReadAndProcessOnce(ctx context.Context, handler func(context.Context, TelemetryEnvelope) error) (bool, error) {
	if w.client == nil {
		return false, errors.New("redis client is nil")
	}
	if handler == nil {
		return false, errors.New("telemetry handler is nil")
	}

	result, err := w.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    w.consumerGroup,
		Consumer: w.consumerName,
		Streams:  []string{w.streamName, ">"},
		Count:    1,
		Block:    250 * time.Millisecond,
		NoAck:    false,
	}).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read redis stream: %w", err)
	}

	for _, stream := range result {
		for _, message := range stream.Messages {
			payload, ok := message.Values["payload"].(string)
			if !ok {
				return true, w.retryOrDeadLetter(ctx, message.ID, message.Values, errors.New("redis message payload is missing"))
			}

			var envelope TelemetryEnvelope
			if err := json.Unmarshal([]byte(payload), &envelope); err != nil {
				return true, w.retryOrDeadLetter(ctx, message.ID, message.Values, err)
			}

			if err := handler(ctx, envelope); err != nil {
				return true, w.retryOrDeadLetter(ctx, message.ID, message.Values, err)
			}

			if err := w.client.XAck(ctx, w.streamName, w.consumerGroup, message.ID).Err(); err != nil {
				return true, fmt.Errorf("ack redis stream message %s: %w", message.ID, err)
			}
		}
	}
	return true, nil
}

func (w *StreamWorker) retryOrDeadLetter(ctx context.Context, messageID string, values map[string]interface{}, cause error) error {
	attempts := 0
	if raw, ok := values["attempt"]; ok {
		switch value := raw.(type) {
		case string:
			attempts, _ = strconv.Atoi(value)
		case int64:
			attempts = int(value)
		case int:
			attempts = value
		}
	}
	attempts++

	if attempts >= w.maxAttempts {
		_, err := w.client.XAdd(ctx, &redis.XAddArgs{
			Stream: w.deadLetter,
			Values: map[string]interface{}{
				"original_id": messageID,
				"payload":     values["payload"],
				"attempt":     attempts,
				"error":       cause.Error(),
				"failed_at":   time.Now().UTC().Format(time.RFC3339Nano),
			},
		}).Result()
		if err != nil {
			return fmt.Errorf("write dead-letter message: %w", err)
		}
		if err := w.client.XAck(ctx, w.streamName, w.consumerGroup, messageID).Err(); err != nil {
			return fmt.Errorf("ack dead-lettered message: %w", err)
		}
		return nil
	}

	_, err := w.client.XAdd(ctx, &redis.XAddArgs{
		Stream: w.streamName,
		Values: map[string]interface{}{
			"event_id":       values["event_id"],
			"organization_id": values["organization_id"],
			"endpoint_id":    values["endpoint_id"],
			"payload":        values["payload"],
			"attempt":        attempts,
			"last_error":     cause.Error(),
		},
	}).Result()
	if err != nil {
		return fmt.Errorf("requeue telemetry message: %w", err)
	}
	if err := w.client.XAck(ctx, w.streamName, w.consumerGroup, messageID).Err(); err != nil {
		return fmt.Errorf("ack retried message: %w", err)
	}
	return nil
}

func (w *StreamWorker) Run(ctx context.Context, handler func(context.Context, TelemetryEnvelope) error) error {
	if err := w.EnsureConsumerGroup(ctx); err != nil {
		return err
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if _, err := w.ReadAndProcessOnce(ctx, handler); err != nil {
			log.Printf("[StreamWorker] processing error: %v", err)
		}
	}
}
