package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Timestamp time.Time `json:"timestamp"`
}

func tenantContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// In production, organization ID must be derived from authenticated session / token context
		orgID := r.Header.Get("X-Organization-ID")
		if orgID == "" {
			orgID = "org-unauthenticated"
		}
		r.Header.Set("X-Verified-Organization-ID", orgID)
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:    "healthy",
			Service:   "sentinelpulse-go-backend",
			Timestamp: time.Now().UTC(),
		})
	})

	mux.HandleFunc("/api/v1/telemetry", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		orgID := r.Header.Get("X-Verified-Organization-ID")
		log.Printf("[Ingestion] Received telemetry for organization: %s", orgID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"success":true,"queued":true}`))
	})

	handler := tenantContextMiddleware(mux)

	log.Printf("Canonical Go backend starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
