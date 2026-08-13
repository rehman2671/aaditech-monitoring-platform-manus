package config

import (
	"fmt"
	"os"
)

type Config struct {
	HttpPort             string
	Env                  string
	DatabaseUrl          string
	RedisUrl             string
	JwtSecret            string
	JwtIssuer            string
	StreamName           string
	ConsumerGroup        string
	ConsumerName         string
	MaxPayloadBytes      int64
}

func LoadConfig() (*Config, error) {
	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		return nil, fmt.Errorf("FATAL: DATABASE_URL is required for production startup")
	}

	redisUrl := os.Getenv("REDIS_URL")
	if redisUrl == "" {
		return nil, fmt.Errorf("FATAL: REDIS_URL is required for production startup")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" || len(jwtSecret) < 32 {
		return nil, fmt.Errorf("FATAL: JWT_SECRET is required and must be at least 32 bytes")
	}

	port := os.Getenv("HTTP_PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "production"
	}

	return &Config{
		HttpPort:        port,
		Env:             env,
		DatabaseUrl:     dbUrl,
		RedisUrl:        redisUrl,
		JwtSecret:       jwtSecret,
		JwtIssuer:       "sentinelpulse-auth",
		StreamName:      "sentinelpulse:telemetry",
		ConsumerGroup:   "sentinelpulse:persistence",
		ConsumerName:    "worker-1",
		MaxPayloadBytes: 1024 * 1024, // 1MB
	}, nil
}
