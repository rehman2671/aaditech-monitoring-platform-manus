package api

import (
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type DiagnosticHandler struct {
	db *sql.DB
}

func NewDiagnosticHandler(db *sql.DB) *DiagnosticHandler {
	return &DiagnosticHandler{db: db}
}

type DiagnosticEvent struct {
	ID            int       `json:"id"`
	TenantID      string    `json:"tenant_id"`
	Component     string    `json:"component"`
	Level         string    `json:"level"`
	Category      string    `json:"category"`
	Message       string    `json:"message"`
	Details       *string   `json:"details,omitempty"`
	CorrelationID *string   `json:"correlation_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

func (h *DiagnosticHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	if !requireAdmin(w, r) {
		return
	}
	claims := claimsFromRequest(r)

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, tenant_id, component, level, category, message, details, correlation_id, created_at
		FROM diagnostic_events
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT 100`, claims.OrganizationID)
	if err != nil {
		http.Error(w, "Failed to query diagnostic events", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	events := []DiagnosticEvent{}
	for rows.Next() {
		var ev DiagnosticEvent
		var details, correlation sql.NullString
		if err := rows.Scan(&ev.ID, &ev.TenantID, &ev.Component, &ev.Level, &ev.Category, &ev.Message, &details, &correlation, &ev.CreatedAt); err != nil {
			continue
		}
		if details.Valid {
			ev.Details = &details.String
		}
		if correlation.Valid {
			ev.CorrelationID = &correlation.String
		}
		events = append(events, ev)
	}

	writeJSON(w, http.StatusOK, events)
}

func RecordDiagnosticEvent(db *sql.DB, tenantID, component, level, category, message, details, correlationID string) {
	if tenantID == "" {
		tenantID = "org-tenant-default"
	}
	go func() {
		_, _ = db.Exec(`
			INSERT INTO diagnostic_events (tenant_id, component, level, category, message, details, correlation_id, created_at)
			VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), NOW())`,
			tenantID, component, level, category, message, strings.TrimSpace(details), strings.TrimSpace(correlationID))
	}()
}
