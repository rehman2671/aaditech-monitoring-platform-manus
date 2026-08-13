package http

import (
	"context"
	"database/sql"
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

	// Setup & Authentication endpoints
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

	// Telemetry Ingress
	mux.Handle("/api/v1/telemetry", telemetry.HandleTelemetryIngest(s.rdb, s.cfg.StreamName))

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

	return mux
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Unauthorized: missing bearer token", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := auth.ValidateToken(tokenStr, s.cfg.JwtSecret)
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
