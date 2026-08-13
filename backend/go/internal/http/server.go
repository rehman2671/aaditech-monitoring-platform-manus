package http

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sentinelpulse/backend/internal/config"

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

	return mux
}

func errToString(err error) string {
	if err == nil {
		return "ok"
	}
	return err.Error()
}
