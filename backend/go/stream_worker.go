package main

import (
	"context"
	"encoding/json"
	"log"
	"time"
)

type TelemetryEnvelope struct {
	SchemaVersion string                 `json:"schema_version"`
	EventID       string                 `json:"event_id"`
	EndpointID    string                 `json:"endpoint_id"`
	OrganizationID string                `json:"organization_id"`
	CaptureTime   time.Time              `json:"capture_time"`
	SequenceNo    int64                  `json:"sequence_number"`
	Module        string                 `json:"module"`
	Payload       map[string]interface{} `json:"payload"`
}

type StreamWorker struct {
	streamName   string
	consumerGroup string
	consumerName  string
}

func NewStreamWorker(streamName, consumerGroup, consumerName string) *StreamWorker {
	return &StreamWorker{
		streamName:    streamName,
		consumerGroup: consumerGroup,
		consumerName:  consumerName,
	}
}

func (w *StreamWorker) ProcessEnvelope(ctx context.Context, data []byte) error {
	var envelope TelemetryEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		log.Printf("[StreamWorker] Error unmarshaling telemetry envelope: %v", err)
		return err
	}

	log.Printf("[StreamWorker] Processed telemetry for endpoint %s [module: %s, seq: %d]", envelope.EndpointID, envelope.Module, envelope.SequenceNo)
	return nil
}
