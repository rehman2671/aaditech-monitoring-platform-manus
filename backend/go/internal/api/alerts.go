package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/sentinelpulse/backend/internal/auth"

	"github.com/google/uuid"
)

type AlertRule struct {
	ID        string  `json:"id"`
	TenantID  string  `json:"tenant_id"`
	Metric    string  `json:"metric"`
	Operator  string  `json:"operator"`
	Threshold float64 `json:"threshold"`
	Severity  string  `json:"severity"`
	Enabled   bool    `json:"enabled"`
}

type AlertHandler struct {
	db *sql.DB
}

func NewAlertHandler(db *sql.DB) *AlertHandler {
	return &AlertHandler{db: db}
}

func (h *AlertHandler) ListRules(w http.ResponseWriter, r *http.Request, claims *auth.Claims) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.db.QueryContext(r.Context(), "SELECT id, tenant_id, metric, operator, threshold, severity, enabled FROM alert_rules WHERE tenant_id = $1", claims.OrganizationID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Metric, &r.Operator, &r.Threshold, &r.Severity, &r.Enabled); err != nil {
			continue
		}
		rules = append(rules, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rules)
}

func (h *AlertHandler) CreateRule(w http.ResponseWriter, r *http.Request, claims *auth.Claims) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Metric    string  `json:"metric"`
		Operator  string  `json:"operator"`
		Threshold float64 `json:"threshold"`
		Severity  string  `json:"severity"`
		Enabled   bool    `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ruleID := uuid.New().String()
	_, err := h.db.ExecContext(r.Context(),
		"INSERT INTO alert_rules (id, tenant_id, metric, operator, threshold, severity, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		ruleID, claims.OrganizationID, req.Metric, req.Operator, req.Threshold, req.Severity, req.Enabled,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AlertRule{
		ID:        ruleID,
		TenantID:  claims.OrganizationID,
		Metric:    req.Metric,
		Operator:  req.Operator,
		Threshold: req.Threshold,
		Severity:  req.Severity,
		Enabled:   req.Enabled,
	})
}
