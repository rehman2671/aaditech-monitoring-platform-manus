package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
)

type EndpointHandler struct {
	db *sql.DB
}

func NewEndpointHandler(db *sql.DB) *EndpointHandler {
	return &EndpointHandler{db: db}
}

func (h *EndpointHandler) ListEndpoints(w http.ResponseWriter, r *http.Request, claims *auth.Claims) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, hostname, ip_address, os_version, status, last_seen, created_at
		FROM endpoints
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`, claims.OrganizationID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Endpoint struct {
		ID        string  `json:"id"`
		Hostname  string  `json:"hostname"`
		IPAddress string  `json:"ip_address"`
		OSVersion string  `json:"os_version"`
		Status    string  `json:"status"`
		LastSeen  *string `json:"last_seen"`
		CreatedAt string  `json:"created_at"`
	}

	var endpoints []Endpoint
	for rows.Next() {
		var e Endpoint
		var lastSeen, createdAt sql.NullTime
		if err := rows.Scan(&e.ID, &e.Hostname, &e.IPAddress, &e.OSVersion, &e.Status, &lastSeen, &createdAt); err != nil {
			http.Error(w, "Invalid endpoint row", http.StatusInternalServerError)
			return
		}
		if lastSeen.Valid {
			ls := lastSeen.Time.UTC().Format(time.RFC3339)
			e.LastSeen = &ls
		}
		if createdAt.Valid {
			e.CreatedAt = createdAt.Time.UTC().Format(time.RFC3339)
		}
		endpoints = append(endpoints, e)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Endpoint query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(endpoints); err != nil {
		return
	}
}
