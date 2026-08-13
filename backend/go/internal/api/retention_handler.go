package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/repository"
)

type RetentionRequest struct {
	RetentionDays int  `json:"retention_days"`
	DryRun        bool `json:"dry_run"`
}

type RetentionResponse struct {
	Status       string `json:"status"`
	RowsAffected int64  `json:"rows_affected"`
	DryRun       bool   `json:"dry_run"`
}

func HandleAdminRetentionPurge(db *sql.DB) http.HandlerFunc {
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

		// Enforce Admin RBAC check
		if claims.Role != "admin" {
			http.Error(w, "Forbidden: Admin role required for retention purge", http.StatusForbidden)
			return
		}

		var req RetentionRequest
		if r.Body != nil {
			_ = json.NewDecoder(r.Body).Decode(&req)
		}

		policy := repository.RetentionPolicy{
			RetentionDays: req.RetentionDays,
			DryRun:        req.DryRun,
		}

		affected, err := repository.PurgeOldAuditLogs(r.Context(), db, policy)
		if err != nil {
			http.Error(w, "Failed to execute retention policy: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(RetentionResponse{
			Status:       "success",
			RowsAffected: affected,
			DryRun:       policy.DryRun,
		})
	}
}
