package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
)

type ErrorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type AuditEntry struct {
	ID             int64     `json:"id"`
	Timestamp      time.Time `json:"timestamp"`
	OrganizationID string    `json:"organization_id"`
	Actor          string    `json:"actor"`
	Action         string    `json:"action"`
	Target         string    `json:"target,omitempty"`
	Outcome        string    `json:"outcome"`
}

type PersistentAuditRepository struct {
	db       *sql.DB
	mu       sync.Mutex
	fallback []AuditEntry
	nextID   int64
}

func NewPersistentAuditRepository(db *sql.DB) *PersistentAuditRepository {
	return &PersistentAuditRepository{
		db:       db,
		fallback: make([]AuditEntry, 0),
		nextID:   1,
	}
}

func (r *PersistentAuditRepository) Log(orgID, actor, action, target, outcome string) (AuditEntry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UTC()

	if r.db != nil {
		var id int64
		err := r.db.QueryRow(
			`INSERT INTO audit_logs (organization_id, actor, action, target, outcome, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			orgID, actor, action, target, outcome, now,
		).Scan(&id)
		if err == nil {
			return AuditEntry{
				ID:             id,
				Timestamp:      now,
				OrganizationID: orgID,
				Actor:          actor,
				Action:         action,
				Target:         target,
				Outcome:        outcome,
			}, nil
		}
	}

	entry := AuditEntry{
		ID:             r.nextID,
		Timestamp:      now,
		OrganizationID: orgID,
		Actor:          actor,
		Action:         action,
		Target:         target,
		Outcome:        outcome,
	}
	r.nextID++
	r.fallback = append(r.fallback, entry)
	return entry, nil
}

func (r *PersistentAuditRepository) List(orgID string) ([]AuditEntry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.db != nil {
		rows, err := r.db.Query(
			`SELECT id, organization_id, actor, action, target, outcome, created_at FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100`,
			orgID,
		)
		if err == nil {
			defer rows.Close()
			var entries []AuditEntry
			for rows.Next() {
				var e AuditEntry
				if err := rows.Scan(&e.ID, &e.OrganizationID, &e.Actor, &e.Action, &e.Target, &e.Outcome, &e.Timestamp); err == nil {
					entries = append(entries, e)
				}
			}
			return entries, nil
		}
	}

	var result []AuditEntry
	for _, e := range r.fallback {
		if e.OrganizationID == orgID {
			result = append(result, e)
		}
	}
	return result, nil
}

var auditRepo *PersistentAuditRepository

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	errResp := ErrorResponse{}
	errResp.Error.Code = code
	errResp.Error.Message = message
	_ = json.NewEncoder(w).Encode(errResp)
}

type AuthenticatedUser struct {
	Email          string
	OrganizationID string
	Role           string
}

func verifyJWTAndDeriveContext(r *http.Request) (*AuthenticatedUser, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, errors.New("missing authorization header")
	}
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("server JWT secret is not configured")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %v", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	email, _ := claims["email"].(string)
	orgID, _ := claims["org_id"].(string)
	role, _ := claims["role"].(string)

	if orgID == "" || email == "" {
		return nil, errors.New("token claims missing organization or subject identity")
	}

	if role == "" {
		role = "viewer"
	}

	return &AuthenticatedUser{
		Email:          email,
		OrganizationID: orgID,
		Role:           role,
	}, nil
}

func securityAndTenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		user, err := verifyJWTAndDeriveContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", fmt.Sprintf("Authentication failed: %v", err))
			return
		}

		r.Header.Set("X-Verified-Organization-ID", user.OrganizationID)
		r.Header.Set("X-Verified-User-Email", user.Email)
		r.Header.Set("X-Verified-User-Role", user.Role)

		if strings.HasPrefix(r.URL.Path, "/api/v1/admin") && user.Role != "admin" {
			if auditRepo != nil {
				_, _ = auditRepo.Log(user.OrganizationID, user.Email, r.URL.Path, "ADMIN_ROUTE", "FORBIDDEN")
			}
			writeError(w, http.StatusForbidden, "FORBIDDEN", "Administrator role required for this operation")
			return
		}

		log.Printf("[Security] User: %s | Role: %s | Tenant: %s | Path: %s", user.Email, user.Role, user.OrganizationID, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func openDatabaseForEnvironment(env, databaseURL string) (*sql.DB, error) {
	if databaseURL == "" {
		if env == "production" || env == "prod" {
			return nil, errors.New("DATABASE_URL is mandatory in production mode")
		}
		return nil, nil
	}
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open PostgreSQL connection: %w", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping PostgreSQL connection: %w", err)
	}
	return db, nil
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = os.Getenv("NODE_ENV")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if (env == "production" || env == "prod") && jwtSecret == "" {
		log.Fatal("[Security] Fatal: JWT_SECRET environment variable is mandatory in production mode.")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	db, err := openDatabaseForEnvironment(env, databaseURL)
	if err != nil {
		log.Fatalf("[Database] Fatal startup check failed: %v", err)
	}
	if db != nil {
		log.Println("[Database] Successfully connected to PostgreSQL hypertable database.")
	} else {
		log.Println("[Database] Warning: DATABASE_URL not set. Running with memory audit store fallback (development mode).")
	}

	auditRepo = NewPersistentAuditRepository(db)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":    "healthy",
			"service":   "sentinelpulse-canonical-backend",
			"timestamp": time.Now().UTC(),
		})
	})

	mux.HandleFunc("/api/v1/telemetry", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Only POST method is permitted for telemetry ingress")
			return
		}

		orgID := r.Header.Get("X-Verified-Organization-ID")
		email := r.Header.Get("X-Verified-User-Email")

		if auditRepo != nil {
			_, _ = auditRepo.Log(orgID, email, "INGEST_TELEMETRY", "TelemetryStream", "SUCCESS")
		}

		writeJSON(w, http.StatusAccepted, map[string]interface{}{
			"success": true,
			"queued":  true,
			"tenant":  orgID,
		})
	})

	mux.HandleFunc("/api/v1/admin/audit", func(w http.ResponseWriter, r *http.Request) {
		orgID := r.Header.Get("X-Verified-Organization-ID")
		var entries []AuditEntry
		var err error
		if auditRepo != nil {
			entries, err = auditRepo.List(orgID)
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to query audit logs")
			return
		}
		writeJSON(w, http.StatusOK, entries)
	})

	handler := securityAndTenantMiddleware(mux)

	log.Printf("Canonical Go backend running securely on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
