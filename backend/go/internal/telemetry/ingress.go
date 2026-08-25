package telemetry

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

type deviceIdentityContextKey struct{}

type DeviceIdentity struct {
	EndpointID string
	TenantID   string
}

func WithDeviceIdentity(ctx context.Context, identity DeviceIdentity) context.Context {
	return context.WithValue(ctx, deviceIdentityContextKey{}, identity)
}

func DeviceIdentityFromContext(ctx context.Context) (DeviceIdentity, bool) {
	identity, ok := ctx.Value(deviceIdentityContextKey{}).(DeviceIdentity)
	return identity, ok && identity.EndpointID != "" && identity.TenantID != ""
}

type TelemetryEnvelope struct {
	SchemaVersion  string          `json:"schema_version"`
	EventID        string          `json:"event_id"`
	EndpointID     string          `json:"endpoint_id"`
	SequenceNumber int64           `json:"sequence_number"`
	CaptureTime    string          `json:"capture_time"`
	Module         string          `json:"module"`
	TenantID       string          `json:"tenant_id,omitempty"`
	Payload        json.RawMessage `json:"payload"`
}

func HandleTelemetryIngest(rdb *redis.Client, streamName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		// Verify Redis availability fail-fast
		if err := rdb.Ping(ctx).Err(); err != nil {
			http.Error(w, "Service unavailable: Redis persistence queue unreachable", http.StatusServiceUnavailable)
			return
		}

		identity, ok := DeviceIdentityFromContext(r.Context())
		if !ok {
			http.Error(w, "Unauthorized: device credential required", http.StatusUnauthorized)
			return
		}

		var env TelemetryEnvelope
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&env); err != nil {
			http.Error(w, "Invalid telemetry envelope JSON", http.StatusBadRequest)
			return
		}

		if env.EventID == "" || env.EndpointID == "" || env.CaptureTime == "" {
			http.Error(w, "Missing required envelope fields (event_id, endpoint_id, capture_time)", http.StatusBadRequest)
			return
		}
		if env.EndpointID != identity.EndpointID {
			http.Error(w, "Forbidden: endpoint credential does not match envelope endpoint", http.StatusForbidden)
			return
		}
		env.TenantID = identity.TenantID

		payloadBytes, err := json.Marshal(env)
		if err != nil {
			http.Error(w, "Serialization error", http.StatusInternalServerError)
			return
		}

		resID, err := rdb.XAdd(ctx, &redis.XAddArgs{
			Stream: streamName,
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
			"event_id": resID,
		})
	}
}
