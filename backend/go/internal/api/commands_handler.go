package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/repository"
)

type CommandRequest struct {
	CommandType string `json:"command_type"` // "QUARANTINE" or "ISOLATE"
	Payload     string `json:"payload"`
}

func HandleEndpointCommand(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		claims, ok := r.Context().Value("claims").(*auth.Claims)
		if !ok || claims == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Enforce Admin RBAC check for destructive endpoint actions
		if claims.Role != "admin" {
			http.Error(w, "Forbidden: Admin role required to execute endpoint commands", http.StatusForbidden)
			return
		}

		// Extract endpoint ID from path: /api/v1/endpoints/{id}/command
		parts := strings.Split(r.URL.Path, "/")
		// Expected: ["", "api", "v1", "endpoints", "{id}", "command"]
		if len(parts) < 6 || parts[3] != "endpoints" {
			http.Error(w, "Invalid endpoint path", http.StatusBadRequest)
			return
		}
		endpointID := parts[4]

		var req CommandRequest
		if r.Body != nil {
			_ = json.NewDecoder(r.Body).Decode(&req)
		}

		if req.CommandType == "" {
			req.CommandType = "QUARANTINE"
		}

		cmd, err := repository.CreateEndpointCommand(
			r.Context(),
			db,
			claims.OrganizationID,
			endpointID,
			req.CommandType,
			req.Payload,
			claims.Subject,
		)
		if err != nil {
			http.Error(w, "Failed to create endpoint command: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(cmd)
	}
}
