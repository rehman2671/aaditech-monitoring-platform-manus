package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/repository"
)

type ProcessHistoryHandler struct {
	db *sql.DB
}

func NewProcessHistoryHandler(db *sql.DB) *ProcessHistoryHandler {
	return &ProcessHistoryHandler{db: db}
}

func (h *ProcessHistoryHandler) List(w http.ResponseWriter, r *http.Request, claims *auth.Claims, endpointID string) {
	if r.Method != http.MethodGet || claims == nil || strings.TrimSpace(claims.OrganizationID) == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	bucket := r.URL.Query().Get("bucket")
	if bucket == "" {
		bucket = "5m"
	}
	since, until, err := parseHistoryRange(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	buckets, err := repository.QueryProcessHistory(r.Context(), h.db, claims.OrganizationID, endpointID, bucket, since, until)
	if err != nil {
		if strings.HasPrefix(err.Error(), "unsupported process history bucket") || strings.Contains(err.Error(), "history start") {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "Failed to read process history", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"bucket": bucket, "buckets": buckets})
}

func parseHistoryRange(r *http.Request) (time.Time, time.Time, error) {
	parse := func(name string) (time.Time, error) {
		value := strings.TrimSpace(r.URL.Query().Get(name))
		if value == "" {
			return time.Time{}, nil
		}
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			return time.Time{}, &historyTimeError{name: name}
		}
		return parsed.UTC(), nil
	}
	since, err := parse("since")
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	until, err := parse("until")
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	return since, until, nil
}

type historyTimeError struct{ name string }

func (e *historyTimeError) Error() string {
	return "invalid " + e.name + " timestamp; expected RFC3339"
}
