package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/config"
)

type AuthHandler struct {
	db  *sql.DB
	cfg *config.Config
}

func NewAuthHandler(db *sql.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (h *AuthHandler) HandleSetupStatus(w http.ResponseWriter, r *http.Request) {
	var count int
	if err := h.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		writeJSON(w, http.StatusOK, map[string]bool{"setup_complete": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"setup_complete": count > 0})
}

func (h *AuthHandler) HandleSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		CompanyName   string `json:"company_name"`
		LocalIP       string `json:"local_ip"`
		AdminEmail    string `json:"admin_email"`
		AdminPassword string `json:"admin_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]string{"code": "BAD_REQUEST", "message": "Invalid request body"}})
		return
	}
	if strings.TrimSpace(req.CompanyName) == "" || strings.TrimSpace(req.AdminEmail) == "" || len(req.AdminPassword) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]string{"code": "VALIDATION_ERROR", "message": "Company name, username/email, and password of at least 8 characters are required"}})
		return
	}

	var existing int
	if err := h.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM users").Scan(&existing); err == nil && existing > 0 {
		writeJSON(w, http.StatusConflict, map[string]any{"error": map[string]string{"code": "SETUP_COMPLETE", "message": "Platform setup has already been completed"}})
		return
	}

	ctx := r.Context()
	if _, err := h.db.ExecContext(ctx, "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to prepare user credentials"}})
		return
	}
	if _, err := h.db.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS platform_settings (id SERIAL PRIMARY KEY, company_name VARCHAR(255) NOT NULL, local_ip VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to prepare platform settings"}})
		return
	}

	passwordHash, err := auth.HashPassword(req.AdminPassword)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "HASH_ERROR", "message": "Unable to secure administrator password"}})
		return
	}
	orgID := "org-" + time.Now().UTC().Format("20060102150405.000000000")
	openID := "local-" + strings.ToLower(strings.ReplaceAll(req.AdminEmail, "@", "-at-"))

	transaction, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to start setup transaction"}})
		return
	}
	rollback := func() { _ = transaction.Rollback() }
	if _, err = transaction.ExecContext(ctx, "INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", orgID, strings.TrimSpace(req.CompanyName)); err != nil {
		rollback()
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to create organization"}})
		return
	}
	if _, err = transaction.ExecContext(ctx, "INSERT INTO platform_settings (company_name, local_ip) VALUES ($1, $2)", strings.TrimSpace(req.CompanyName), strings.TrimSpace(req.LocalIP)); err != nil {
		rollback()
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to save platform settings"}})
		return
	}
	if _, err = transaction.ExecContext(ctx, "INSERT INTO users (open_id, email, name, role, password_hash) VALUES ($1, $2, $3, 'admin', $4)", openID, strings.TrimSpace(req.AdminEmail), "Platform Administrator", passwordHash); err != nil {
		rollback()
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to create administrator account"}})
		return
	}
	var userID int
	if err = transaction.QueryRowContext(ctx, "SELECT id FROM users WHERE open_id = $1", openID).Scan(&userID); err != nil {
		rollback()
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to resolve administrator account"}})
		return
	}
	if _, err = transaction.ExecContext(ctx, "INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'admin')", userID, orgID); err != nil {
		rollback()
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to link administrator to organization"}})
		return
	}
	if err = transaction.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "DB_ERROR", "message": "Unable to commit platform setup"}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "organization_id": orgID})
}

func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": map[string]string{"code": "BAD_REQUEST", "message": "Invalid login payload"}})
		return
	}
	var id int
	var email, role, hash, orgID string
	err := h.db.QueryRowContext(r.Context(), "SELECT u.id, u.email, u.role, u.password_hash, m.organization_id FROM users u LEFT JOIN memberships m ON m.user_id = u.id WHERE u.email = $1 OR u.open_id = $1 LIMIT 1", req.Email).Scan(&id, &email, &role, &hash, &orgID)
	if err != nil || !auth.CheckPassword(req.Password, hash) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": map[string]string{"code": "UNAUTHORIZED", "message": "Invalid credentials"}})
		return
	}
	var token string
	if h.cfg.JwtPrivateKeyRS256 != "" && h.cfg.JwtPublicKeyRS256 != "" {
		token, err = auth.GenerateTokenRS256(id, email, orgID, role, h.cfg.JwtPrivateKeyRS256, 15*time.Minute)
	} else {
		token, err = auth.GenerateToken(id, email, orgID, role, h.cfg.JwtSecret, 15*time.Minute)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]string{"code": "TOKEN_ERROR", "message": "Unable to issue access token"}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"accessToken": token, "expiresAt": time.Now().UTC().Add(15 * time.Minute).Format(time.RFC3339), "user": map[string]any{"id": id, "email": email, "role": role, "organizationId": orgID}})
}
