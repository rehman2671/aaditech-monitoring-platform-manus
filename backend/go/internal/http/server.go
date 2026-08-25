package http

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/sentinelpulse/backend/internal/api"
	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/config"
	"github.com/sentinelpulse/backend/internal/telemetry"

	"github.com/redis/go-redis/v9"
)

type Server struct {
	cfg *config.Config
	db  *sql.DB
	rdb *redis.Client
}

func NewServer(cfg *config.Config, db *sql.DB, rdb *redis.Client) *Server {
	return &Server{cfg: cfg, db: db, rdb: rdb}
}

func (s *Server) RegisterRoutes() http.Handler {
	mux := http.NewServeMux()

	// First-run setup and local operator authentication.
	authHandler := api.NewAuthHandler(s.db, s.cfg)
	mux.HandleFunc("/api/v1/auth/setup-status", authHandler.HandleSetupStatus)
	mux.HandleFunc("/api/v1/auth/setup", authHandler.HandleSetup)
	mux.HandleFunc("/api/v1/auth/login", authHandler.HandleLogin)

	// Health endpoints
	mux.HandleFunc("/health/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})

	mux.HandleFunc("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		dbErr := s.db.PingContext(ctx)
		redisErr := s.rdb.Ping(ctx).Err()

		if dbErr != nil || redisErr != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"status":   "unhealthy",
				"postgres": errToString(dbErr),
				"redis":    errToString(redisErr),
			})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})

	// Telemetry ingress is authenticated with the one-time-enrolled device credential.
	mux.Handle("/api/v1/telemetry", s.requireDeviceAuth(telemetry.HandleTelemetryIngest(s.rdb, s.cfg.StreamName)))

	// Enrollment
	enrollmentHandler := api.NewEnrollmentHandler(s.db)
	mux.HandleFunc("/api/v1/agents/enroll", enrollmentHandler.EnrollAgent)
	mux.HandleFunc("/api/v1/agent/enroll", enrollmentHandler.EnrollAgent)
	mux.Handle("/api/v1/enrollment-tokens", s.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value("claims").(*auth.Claims)
		enrollmentHandler.CreateToken(w, r, claims)
	})))

	// Endpoints
	endpointHandler := api.NewEndpointHandler(s.db)
	mux.Handle("/api/v1/endpoints", s.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value("claims").(*auth.Claims)
		endpointHandler.ListEndpoints(w, r, claims)
	})))

	// Endpoint Command Execution (Admin RBAC required)
	mux.Handle("/api/v1/endpoints/", s.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/command") && r.Method == http.MethodPost {
			api.HandleEndpointCommand(s.db)(w, r)
			return
		}
		http.NotFound(w, r)
	})))

	// Alert Rules & Webhook Testing
	alertHandler := api.NewAlertHandler(s.db)
	mux.Handle("/api/v1/alert-rules", s.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value("claims").(*auth.Claims)
		if r.Method == http.MethodGet {
			alertHandler.ListRules(w, r, claims)
		} else if r.Method == http.MethodPost {
			alertHandler.CreateRule(w, r, claims)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/alert-rules/test", s.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value("claims").(*auth.Claims)
		alertHandler.TestWebhook(w, r, claims)
	})))

	// Admin Retention Purge Route (Admin RBAC required)
	mux.Handle("/api/v1/admin/retention/purge", s.requireAuth(http.HandlerFunc(api.HandleAdminRetentionPurge(s.db))))

	// Admin Diagnostics Audit Trail
	diagHandler := api.NewDiagnosticHandler(s.db)
	mux.Handle("/api/v1/admin/diagnostics", s.requireAuth(http.HandlerFunc(diagHandler.ListEvents)))

	// Windows MSI builder and signed artifact workflow.
	msiBuilder := api.NewMSIBuildHandler(s.db, s.cfg.MSIArtifactDir, s.cfg.MSIBuilderKey)
	mux.Handle("/api/v1/admin/msi-builder/status", s.requireAuth(http.HandlerFunc(msiBuilder.AdminStatus)))
	mux.Handle("/api/v1/admin/msi-builds", s.requireAuth(http.HandlerFunc(msiBuilder.ListOrCreate)))
	mux.Handle("/api/v1/admin/msi-builds/", s.requireAuth(http.HandlerFunc(msiBuilder.Detail)))
	mux.Handle("/api/v1/admin/msi-latest/download", s.requireAuth(http.HandlerFunc(msiBuilder.DownloadLatest)))
	mux.HandleFunc("/api/v1/internal/msi-builder/heartbeat", msiBuilder.InternalHeartbeat)
	mux.HandleFunc("/api/v1/internal/msi-builder/next", msiBuilder.InternalNext)
	mux.HandleFunc("/api/v1/internal/msi-builder/status", msiBuilder.InternalStatus)

	return mux
}

func (s *Server) requireDeviceAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Unauthorized: device bearer token required", http.StatusUnauthorized)
			return
		}
		rawToken := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if rawToken == "" {
			http.Error(w, "Unauthorized: device bearer token required", http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(rawToken))
		var endpointID, tenantID string
		err := s.db.QueryRowContext(r.Context(), `
			SELECT c.endpoint_id, e.tenant_id
			FROM endpoint_credentials c
			JOIN endpoints e ON e.id = c.endpoint_id
			WHERE c.device_token_hash = $1 AND c.revoked = FALSE
		`, hex.EncodeToString(hash[:])).Scan(&endpointID, &tenantID)
		if err == sql.ErrNoRows {
			http.Error(w, "Unauthorized: invalid or revoked device token", http.StatusUnauthorized)
			return
		}
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		ctx := telemetry.WithDeviceIdentity(r.Context(), telemetry.DeviceIdentity{EndpointID: endpointID, TenantID: tenantID})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Unauthorized: missing bearer token", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		var claims *auth.Claims
		var err error
		if s.cfg.JwtPrivateKeyRS256 != "" && s.cfg.JwtPublicKeyRS256 != "" {
			claims, err = auth.ValidateTokenRS256(tokenStr, s.cfg.JwtPublicKeyRS256)
		} else {
			claims, err = auth.ValidateToken(tokenStr, s.cfg.JwtSecret)
		}
		if err != nil {
			http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func errToString(err error) string {
	if err == nil {
		return "ok"
	}
	return err.Error()
}
