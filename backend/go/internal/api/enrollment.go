package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sentinelpulse/backend/internal/auth"
)

type EnrollmentHandler struct {
	db *sql.DB
}

func NewEnrollmentHandler(db *sql.DB) *EnrollmentHandler {
	return &EnrollmentHandler{db: db}
}

var enrollmentTokenPattern = regexp.MustCompile(`^sp-enrol-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func hashToken(raw string) string {
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

func (h *EnrollmentHandler) CreateToken(w http.ResponseWriter, r *http.Request, claims *auth.Claims) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rawToken := "sp-enrol-" + uuid.New().String()
	tokenHash := hashToken(rawToken)
	expiresAt := time.Now().Add(24 * time.Hour)

	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO enrollment_tokens (token_hash, tenant_id, expires_at, created_at)
		VALUES ($1, $2, $3, NOW())
	`, tokenHash, claims.OrganizationID, expiresAt)

	if err != nil {
		http.Error(w, "Failed to persist enrollment token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"enrollment_token": rawToken,
		"expires_at":       expiresAt.Format(time.RFC3339),
		"organization_id":  claims.OrganizationID,
	})
}

func (h *EnrollmentHandler) EnrollAgent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token      string `json:"token"`
		EndpointID string `json:"endpoint_id"`
		Hostname   string `json:"hostname"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid enrollment request payload", http.StatusBadRequest)
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	req.EndpointID = strings.TrimSpace(req.EndpointID)
	req.Hostname = strings.TrimSpace(req.Hostname)
	if req.Token == "" || req.EndpointID == "" {
		http.Error(w, "Invalid enrollment request payload", http.StatusBadRequest)
		return
	}
	if !enrollmentTokenPattern.MatchString(req.Token) {
		http.Error(w, "Invalid enrollment token format", http.StatusUnauthorized)
		return
	}

	tokenHash := hashToken(req.Token)

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var tenantID string
	var expiresAt time.Time
	var consumedAt sql.NullTime

	err = tx.QueryRowContext(r.Context(), `
		SELECT tenant_id, expires_at, consumed_at
		FROM enrollment_tokens
		WHERE token_hash = $1
	`, tokenHash).Scan(&tenantID, &expiresAt, &consumedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid enrollment token", http.StatusUnauthorized)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if consumedAt.Valid {
		_, _ = tx.ExecContext(r.Context(), `UPDATE endpoints SET status = 'enrollment_failed', status_reason = 'Enrollment token already consumed', status_changed_at = NOW() WHERE id = $1 AND tenant_id = $2`, req.EndpointID, tenantID)
		http.Error(w, "Enrollment token already consumed", http.StatusUnauthorized)
		return
	}

	if time.Now().After(expiresAt) {
		_, _ = tx.ExecContext(r.Context(), `UPDATE endpoints SET status = 'enrollment_failed', status_reason = 'Enrollment token expired', status_changed_at = NOW() WHERE id = $1 AND tenant_id = $2`, req.EndpointID, tenantID)
		http.Error(w, "Enrollment token expired", http.StatusUnauthorized)
		return
	}

	// Consume token atomically
	_, err = tx.ExecContext(r.Context(), `
		UPDATE enrollment_tokens
		SET consumed_at = NOW(), consumed_by_endpoint_id = $2
		WHERE token_hash = $1
	`, tokenHash, req.EndpointID)
	if err != nil {
		http.Error(w, "Failed to consume token", http.StatusInternalServerError)
		return
	}

	// Register or update endpoint
	_, err = tx.ExecContext(r.Context(), `
INSERT INTO endpoints (id, tenant_id, hostname, status, status_reason, status_changed_at, last_seen, created_at)
			VALUES ($1, $2, $3, 'pending', 'Enrollment succeeded; awaiting first telemetry evidence', NOW(), NULL, NOW())
			ON CONFLICT (id) DO UPDATE SET tenant_id = $2, hostname = $3, status = 'pending', status_reason = 'Re-enrolled; awaiting first telemetry evidence', status_changed_at = NOW()
	`, req.EndpointID, tenantID, req.Hostname)
	if err != nil {
		http.Error(w, "Failed to register endpoint", http.StatusInternalServerError)
		return
	}

	deviceToken := "sp-agent-" + uuid.New().String()
	deviceTokenHash := hashToken(deviceToken)

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO endpoint_credentials (endpoint_id, device_token_hash, revoked, created_at)
		VALUES ($1, $2, FALSE, NOW())
		ON CONFLICT (endpoint_id) DO UPDATE SET device_token_hash = $2, revoked = FALSE
	`, req.EndpointID, deviceTokenHash)
	if err != nil {
		http.Error(w, "Failed to provision agent credential", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit enrollment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"device_token": deviceToken,
		"endpoint_id":  req.EndpointID,
		"tenant_id":    tenantID,
	})
}
