package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/ollama"
)

type AnalystHandler struct {
	db     *sql.DB
	client *ollama.Client
}

func NewAnalystHandler(db *sql.DB, client *ollama.Client) *AnalystHandler {
	return &AnalystHandler{db: db, client: client}
}

type analystEvidence struct {
	ID           string      `json:"id"`
	Source       string      `json:"source"`
	CapturedAt   *time.Time  `json:"captured_at,omitempty"`
	Availability string      `json:"availability"`
	Value        interface{} `json:"value,omitempty"`
}

type analystSnapshot struct {
	EndpointID string            `json:"endpoint_id"`
	Evidence   []analystEvidence `json:"evidence"`
}

func (h *AnalystHandler) Latest(w http.ResponseWriter, r *http.Request, claims *auth.Claims, endpointID string) {
	if r.Method != http.MethodGet || claims == nil || strings.TrimSpace(claims.OrganizationID) == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var evidenceHash, provider, model string
	var generatedAt time.Time
	var available bool
	var unavailableReason sql.NullString
	var assessmentJSON []byte
	err := h.db.QueryRowContext(r.Context(), `
		SELECT evidence_hash, provider, model, generated_at, available, unavailable_reason, assessment_json
		FROM analyst_assessments
		WHERE tenant_id = $1 AND endpoint_id = $2
		ORDER BY generated_at DESC
		LIMIT 1
	`, claims.OrganizationID, endpointID).Scan(&evidenceHash, &provider, &model, &generatedAt, &available, &unavailableReason, &assessmentJSON)
	if err == sql.ErrNoRows {
		http.Error(w, "No analyst assessment available", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Failed to read analyst assessment", http.StatusInternalServerError)
		return
	}
	var assessment interface{}
	if len(assessmentJSON) > 0 && json.Valid(assessmentJSON) {
		assessment = json.RawMessage(assessmentJSON)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"evidence_hash": evidenceHash, "provider": provider, "model": model,
		"generated_at": generatedAt.UTC(), "available": available,
		"unavailable_reason": analystNullableString(unavailableReason), "assessment": assessment,
	})
}

func (h *AnalystHandler) Analyze(w http.ResponseWriter, r *http.Request, claims *auth.Claims, endpointID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if claims == nil || strings.TrimSpace(claims.OrganizationID) == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	endpointID = strings.TrimSpace(endpointID)
	if endpointID == "" || strings.Contains(endpointID, "/") {
		http.Error(w, "Invalid endpoint ID", http.StatusBadRequest)
		return
	}

	snapshot, err := h.buildSnapshot(r, claims.OrganizationID, endpointID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Endpoint not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to build analyst evidence snapshot", http.StatusInternalServerError)
		return
	}
	summary, err := json.Marshal(snapshot)
	if err != nil {
		http.Error(w, "Failed to encode analyst evidence snapshot", http.StatusInternalServerError)
		return
	}
	hash := sha256.Sum256(summary)
	evidenceIDs := make([]string, 0, len(snapshot.Evidence))
	for _, evidence := range snapshot.Evidence {
		evidenceIDs = append(evidenceIDs, evidence.ID)
	}
	evidenceHash := hex.EncodeToString(hash[:])
	result := h.client.Analyze(r.Context(), ollama.Input{
		EndpointID:      endpointID,
		EvidenceHash:    evidenceHash,
		EvidenceIDs:     evidenceIDs,
		EvidenceSummary: string(summary),
	})
	persisted := false
	if result.Available {
		assessmentJSON, err := json.Marshal(result.Assessment)
		if err != nil {
			http.Error(w, "Failed to encode analyst assessment", http.StatusInternalServerError)
			return
		}
		_, err = h.db.ExecContext(r.Context(), `
			INSERT INTO analyst_assessments
			(tenant_id, endpoint_id, evidence_hash, provider, model, generated_at, available, unavailable_reason, assessment_json)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (tenant_id, endpoint_id, evidence_hash) DO UPDATE SET
			provider = EXCLUDED.provider, model = EXCLUDED.model, generated_at = EXCLUDED.generated_at,
			available = EXCLUDED.available, unavailable_reason = EXCLUDED.unavailable_reason, assessment_json = EXCLUDED.assessment_json
		`, claims.OrganizationID, endpointID, evidenceHash, result.Assessment.Provider, result.Assessment.Model,
			result.Assessment.GeneratedAt, result.Assessment.Available, result.Assessment.UnavailableReason, assessmentJSON)
		if err != nil {
			http.Error(w, "Failed to persist analyst assessment", http.StatusInternalServerError)
			return
		}
		persisted = true
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"available":      result.Available,
		"reason":         result.Reason,
		"evidence_hash":  evidenceHash,
		"evidence_count": len(snapshot.Evidence),
		"persisted":      persisted,
		"assessment":     result.Assessment,
	})
}

func (h *AnalystHandler) buildSnapshot(r *http.Request, tenantID, endpointID string) (analystSnapshot, error) {
	var hostname, status string
	var statusReason sql.NullString
	var lastSeen sql.NullTime
	if err := h.db.QueryRowContext(r.Context(), `
		SELECT hostname, status, status_reason, last_seen
		FROM endpoints
		WHERE id = $1 AND tenant_id = $2
	`, endpointID, tenantID).Scan(&hostname, &status, &statusReason, &lastSeen); err != nil {
		return analystSnapshot{}, err
	}

	snapshot := analystSnapshot{EndpointID: endpointID, Evidence: []analystEvidence{
		{ID: "endpoint.identity", Source: "endpoints", Availability: "OBSERVED", Value: map[string]interface{}{"hostname": hostname}},
		{ID: "endpoint.lifecycle", Source: "endpoints", Availability: "OBSERVED", CapturedAt: nullableTime(lastSeen), Value: map[string]interface{}{"status": status, "status_reason": analystNullableString(statusReason)}},
	}}

	var capturedAt time.Time
	var cpu, ram, disk, temperature sql.NullFloat64
	err := h.db.QueryRowContext(r.Context(), `
		SELECT captured_at, cpu_utilization, ram_utilization, disk_utilization, temperature_c
		FROM endpoint_metrics_hyper
		WHERE tenant_id = $1 AND endpoint_id = $2
		ORDER BY captured_at DESC
		LIMIT 1
	`, tenantID, endpointID).Scan(&capturedAt, &cpu, &ram, &disk, &temperature)
	if err == nil {
		snapshot.Evidence = append(snapshot.Evidence, analystEvidence{
			ID: "metrics.latest", Source: "endpoint_metrics_hyper", CapturedAt: timePtr(capturedAt.UTC()), Availability: "OBSERVED",
			Value: map[string]interface{}{"cpu_utilization": nullableFloat(cpu), "ram_utilization": nullableFloat(ram), "disk_utilization": nullableFloat(disk), "temperature_c": nullableFloat(temperature)},
		})
	} else if err == sql.ErrNoRows {
		snapshot.Evidence = append(snapshot.Evidence, analystEvidence{
			ID: "metrics.latest", Source: "endpoint_metrics_hyper", Availability: "UNAVAILABLE",
			Value: map[string]interface{}{"reason": "no metric sample is persisted for this endpoint"},
		})
	} else {
		return analystSnapshot{}, err
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT captured_at, pid, name, executable_path, signature, cpu_percent, working_set_bytes, availability
		FROM endpoint_process_samples
		WHERE tenant_id = $1 AND endpoint_id = $2
		ORDER BY captured_at DESC, working_set_bytes DESC NULLS LAST
		LIMIT 100
	`, tenantID, endpointID)
	if err != nil {
		return analystSnapshot{}, err
	}
	defer rows.Close()
	processCount := 0
	for rows.Next() {
		var processCapturedAt time.Time
		var pid int
		var name string
		var executablePath, signature, availability sql.NullString
		var cpuPercent sql.NullFloat64
		var workingSet sql.NullInt64
		if err := rows.Scan(&processCapturedAt, &pid, &name, &executablePath, &signature, &cpuPercent, &workingSet, &availability); err != nil {
			return analystSnapshot{}, err
		}
		processCount++
		snapshot.Evidence = append(snapshot.Evidence, analystEvidence{
			ID: fmt.Sprintf("process.%d.%s", pid, processCapturedAt.UTC().Format(time.RFC3339Nano)),

			Source: "endpoint_process_samples", CapturedAt: timePtr(processCapturedAt.UTC()),
			Availability: valueOr(availability, "UNKNOWN"),
			Value: map[string]interface{}{
				"pid": pid, "name": name, "executable_path": analystNullableString(executablePath), "signature": analystNullableString(signature),
				"cpu_percent": nullableFloat(cpuPercent), "working_set_bytes": nullableInt64(workingSet),
			},
		})
	}
	if err := rows.Err(); err != nil {
		return analystSnapshot{}, err
	}
	if processCount == 0 {
		snapshot.Evidence = append(snapshot.Evidence, analystEvidence{
			ID: "processes.collection", Source: "endpoint_process_samples", Availability: "UNAVAILABLE",
			Value: map[string]interface{}{"reason": "no successful process collection is persisted for this endpoint"},
		})
	}
	return snapshot, nil
}

func nullableTime(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	return timePtr(value.Time.UTC())
}
func timePtr(value time.Time) *time.Time { return &value }
func analystNullableString(value sql.NullString) interface{} {
	if !value.Valid {
		return nil
	}
	return value.String
}
func nullableFloat(value sql.NullFloat64) interface{} {
	if !value.Valid {
		return nil
	}
	return value.Float64
}
func nullableInt64(value sql.NullInt64) interface{} {
	if !value.Valid {
		return nil
	}
	return value.Int64
}
func valueOr(value sql.NullString, fallback string) string {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return fallback
	}
	return value.String
}
