package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
)

type Config struct {
	HttpPort             string
	Env                  string
	DatabaseUrl          string
	RedisUrl             string
	JwtSecret            string
	JwtPrivateKeyRS256   string
	JwtPublicKeyRS256    string
	JwtIssuer            string
	StreamName           string
	ConsumerGroup        string
	ConsumerName         string
	MaxPayloadBytes      int64
	MSIArtifactDir       string
	MSIBuilderKey        string
	SigningCertPfxPath   string
	SigningCertPassword  string
	ProcessRetentionDays int
	LLMProvider          string
	OllamaBaseURL        string
	OllamaModel          string
	OllamaTimeout        time.Duration
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
	jwtPrivate := strings.TrimSpace(os.Getenv("JWT_PRIVATE_KEY_RS256"))
	jwtPublic := strings.TrimSpace(os.Getenv("JWT_PUBLIC_KEY_RS256"))
	if (jwtPrivate == "") != (jwtPublic == "") {
		return nil, fmt.Errorf("FATAL: JWT_PRIVATE_KEY_RS256 and JWT_PUBLIC_KEY_RS256 must be configured together")
	}
	if jwtPrivate != "" {
		if err := auth.ValidateRS256KeyPair(jwtPrivate, jwtPublic); err != nil {
			return nil, fmt.Errorf("FATAL: invalid RS256 JWT key pair: %w", err)
		}
	} else if jwtSecret == "" || len(jwtSecret) < 32 {
		return nil, fmt.Errorf("FATAL: JWT_SECRET is required and must be at least 32 bytes when RS256 keys are not configured")
	}

	port := os.Getenv("HTTP_PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "production"
	}

	artifactDir := os.Getenv("MSI_ARTIFACT_DIR")
	if artifactDir == "" {
		artifactDir = "/var/lib/sentinelpulse/artifacts"
	}

	processRetentionDays := 30
	if raw := strings.TrimSpace(os.Getenv("PROCESS_SAMPLE_RETENTION_DAYS")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 3650 {
			return nil, fmt.Errorf("FATAL: PROCESS_SAMPLE_RETENTION_DAYS must be an integer between 1 and 3650")
		}
		processRetentionDays = parsed
	}

	llmProvider := strings.ToLower(strings.TrimSpace(os.Getenv("LLM_PROVIDER")))
	if llmProvider == "" {
		llmProvider = "disabled"
	}
	if llmProvider != "disabled" && llmProvider != "ollama" {
		return nil, fmt.Errorf("FATAL: LLM_PROVIDER must be disabled or ollama")
	}
	ollamaTimeout := 8 * time.Second
	if raw := strings.TrimSpace(os.Getenv("OLLAMA_TIMEOUT_MS")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 250 || parsed > 30000 {
			return nil, fmt.Errorf("FATAL: OLLAMA_TIMEOUT_MS must be an integer between 250 and 30000")
		}
		ollamaTimeout = time.Duration(parsed) * time.Millisecond
	}

	return &Config{
		HttpPort:             port,
		Env:                  env,
		DatabaseUrl:          dbUrl,
		RedisUrl:             redisUrl,
		JwtSecret:            jwtSecret,
		JwtPrivateKeyRS256:   jwtPrivate,
		JwtPublicKeyRS256:    jwtPublic,
		JwtIssuer:            "sentinelpulse-auth",
		StreamName:           "sentinelpulse:telemetry",
		ConsumerGroup:        "sentinelpulse:persistence",
		ConsumerName:         "worker-1",
		MaxPayloadBytes:      1024 * 1024,
		MSIArtifactDir:       artifactDir,
		MSIBuilderKey:        os.Getenv("MSI_BUILDER_KEY"),
		SigningCertPfxPath:   os.Getenv("SIGNING_CERT_PFX_PATH"),
		SigningCertPassword:  os.Getenv("SIGNING_CERT_PASSWORD"),
		ProcessRetentionDays: processRetentionDays,
		LLMProvider:          llmProvider,
		OllamaBaseURL:        os.Getenv("OLLAMA_BASE_URL"),
		OllamaModel:          os.Getenv("OLLAMA_MODEL"),
		OllamaTimeout:        ollamaTimeout,
	}, nil
}
