package main

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/sentinelpulse/backend/internal/config"
	custhttp "github.com/sentinelpulse/backend/internal/http"
	"github.com/sentinelpulse/backend/internal/repository"
	"github.com/sentinelpulse/backend/internal/telemetry"

	"github.com/redis/go-redis/v9"
)

func newRedisClient(redisURL string) *redis.Client {
	if strings.HasPrefix(redisURL, "redis://") || strings.HasPrefix(redisURL, "rediss://") {
		options, err := redis.ParseURL(redisURL)
		if err != nil {
			log.Fatalf("Redis configuration error: %v", err)
		}
		return redis.NewClient(options)
	}
	return redis.NewClient(&redis.Options{Addr: redisURL})
}

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

	rdb := newRedisClient(cfg.RedisUrl)
	worker := telemetry.NewWorkerWithRetention(db, rdb, cfg.StreamName, cfg.ConsumerGroup, cfg.ConsumerName, cfg.ProcessRetentionDays)
	go worker.Start(context.Background())

	server, err := custhttp.NewServerWithAnalyst(cfg, db, rdb)
	if err != nil {
		log.Fatalf("Analyst configuration error: %v", err)
	}
	handler := server.RegisterRoutes()

	log.Printf("SentinelPulse Go canonical backend starting on port %s...", cfg.HttpPort)
	if err := http.ListenAndServe(":"+cfg.HttpPort, handler); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
