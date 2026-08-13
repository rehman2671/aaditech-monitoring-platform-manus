package main

import (
	"log"
	"net/http"

	"github.com/sentinelpulse/backend/internal/config"
	custhttp "github.com/sentinelpulse/backend/internal/http"
	"github.com/sentinelpulse/backend/internal/repository"

	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	db, err := repository.ConnectDB(cfg.DatabaseUrl)
	if err != nil {
		log.Fatalf("Database connection error: %v", err)
	}
	defer db.Close()

	if err := repository.RunMigrations(db); err != nil {
		log.Fatalf("Migration error: %v", err)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisUrl,
	})

	server := custhttp.NewServer(cfg, db, rdb)
	handler := server.RegisterRoutes()

	log.Printf("SentinelPulse Go canonical backend starting on port %s...", cfg.HttpPort)
	if err := http.ListenAndServe(":"+cfg.HttpPort, handler); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
