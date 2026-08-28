package config

import (
	"strings"
	"testing"
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
}

func TestLoadConfigRejectsPartialRS256Pair(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("JWT_PRIVATE_KEY_RS256", "private-only")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "must be configured together") {
		t.Fatalf("expected partial RS256 pair error, got %v", err)
	}
}

func TestLoadConfigRejectsShortFallbackSecret(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("JWT_SECRET", "too-short")
	if _, err := LoadConfig(); err == nil || !strings.Contains(err.Error(), "at least 32 bytes") {
		t.Fatalf("expected short secret error, got %v", err)
	}
}
