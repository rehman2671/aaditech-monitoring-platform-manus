package config

import (
	"strings"
	"testing"
	"time"
)

func setRequiredEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://example/db")
	t.Setenv("REDIS_URL", "redis://example:6379")
	t.Setenv("JWT_SECRET", strings.Repeat("s", 32))
	t.Setenv("JWT_PRIVATE_KEY_RS256", "")
	t.Setenv("JWT_PUBLIC_KEY_RS256", "")
	t.Setenv("HTTP_PORT", "")
	t.Setenv("ENV", "")
	t.Setenv("MSI_ARTIFACT_DIR", "")
	t.Setenv("PROCESS_SAMPLE_RETENTION_DAYS", "")
	t.Setenv("LLM_PROVIDER", "")
	t.Setenv("OLLAMA_BASE_URL", "")
	t.Setenv("OLLAMA_MODEL", "")
	t.Setenv("OLLAMA_TIMEOUT_MS", "")
}

func TestLoadConfigAppliesCanonicalDefaults(t *testing.T) {
	setRequiredEnv(t)
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HttpPort != "8080" || cfg.Env != "production" {
		t.Fatalf("unexpected defaults: port=%q env=%q", cfg.HttpPort, cfg.Env)
	}
	if cfg.MSIArtifactDir != "/var/lib/sentinelpulse/artifacts" {
		t.Fatalf("unexpected artifact directory: %q", cfg.MSIArtifactDir)
	}
	if cfg.ProcessRetentionDays != 30 {
		t.Fatalf("unexpected process retention default: %d", cfg.ProcessRetentionDays)
	}
	if cfg.LLMProvider != "disabled" || cfg.OllamaTimeout != 8*time.Second {
		t.Fatalf("unexpected Ollama defaults: provider=%q timeout=%s", cfg.LLMProvider, cfg.OllamaTimeout)
	}
}

func TestLoadConfigRejectsPartialRS256Pair(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("JWT_PRIVATE_KEY_RS256", "private-only")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "must be configured together") {
		t.Fatalf("expected partial RS256 pair error, got %v", err)
	}
}

func TestLoadConfigAcceptsConfiguredProcessRetention(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("PROCESS_SAMPLE_RETENTION_DAYS", "90")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ProcessRetentionDays != 90 {
		t.Fatalf("unexpected configured process retention: %d", cfg.ProcessRetentionDays)
	}
}

func TestLoadConfigRejectsUnboundedProcessRetention(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("PROCESS_SAMPLE_RETENTION_DAYS", "3651")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "PROCESS_SAMPLE_RETENTION_DAYS") {
		t.Fatalf("expected bounded process retention error, got %v", err)
	}
}

func TestLoadConfigAcceptsLocalOllamaConfiguration(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("LLM_PROVIDER", "ollama")
	t.Setenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
	t.Setenv("OLLAMA_MODEL", "qwen2.5:3b")
	t.Setenv("OLLAMA_TIMEOUT_MS", "12000")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.LLMProvider != "ollama" || cfg.OllamaBaseURL != "http://127.0.0.1:11434" || cfg.OllamaModel != "qwen2.5:3b" || cfg.OllamaTimeout != 12*time.Second {
		t.Fatalf("unexpected Ollama configuration: %+v", cfg)
	}
}

func TestLoadConfigRejectsUnsupportedLLMProvider(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("LLM_PROVIDER", "openai")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "LLM_PROVIDER") {
		t.Fatalf("expected unsupported provider error, got %v", err)
	}
}

func TestLoadConfigRejectsUnboundedOllamaTimeout(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("OLLAMA_TIMEOUT_MS", "30001")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "OLLAMA_TIMEOUT_MS") {
		t.Fatalf("expected timeout bounds error, got %v", err)
	}
}

func TestLoadConfigRejectsShortFallbackSecret(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("JWT_SECRET", "too-short")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "at least 32 bytes") {
		t.Fatalf("expected short secret error, got %v", err)
	}
}
