package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

type TelemetryEnvelope struct {
	TenantID        string  `json:"tenant_id"`
	EndpointID      string  `json:"endpoint_id"`
	CpuUtilization  float64 `json:"cpu_utilization"`
	RamUtilization  float64 `json:"ram_utilization"`
	DiskUtilization float64 `json:"disk_utilization"`
	CapturedAt      int64   `json:"captured_at"`
}

func HandleTelemetryIngest(rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var env TelemetryEnvelope
		decoder := json.NewDecoder(req.Body)
		if err := decoder.Decode(&env); err != nil {
			http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}

		if env.TenantID == "" {
			env.TenantID = "org-default"
		}
		if env.CapturedAt == 0 {
			env.CapturedAt = time.Now().UnixMilli()
		}

		payloadBytes, err := json.Marshal(env)
		if err != nil {
			http.Error(w, "Serialization error", http.StatusInternalServerError)
			return
		}

		ctx, cancel := context.WithTimeout(req.Context(), 3*time.Second)
		defer cancel()

		// Publish to Redis Stream with durable backpressure
		resID, err := rdb.XAdd(ctx, &redis.XAddArgs{
			Stream: "telemetry:stream",
			Values: map[string]interface{}{
				"envelope": string(payloadBytes),
			},
		}).Result()

		if err != nil {
			http.Error(w, "Failed to enqueue telemetry to Redis stream", http.StatusServiceUnavailable)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"queued":   true,
			"event_id": resID,
		})
	}
}
