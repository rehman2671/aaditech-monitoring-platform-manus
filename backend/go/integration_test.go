package main

import (
	"os"
	"testing"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/config"
)

func TestIntegration_HealthAndConfig(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	_, err := config.LoadConfig()
	if err == nil {
		t.Fatalf("Expected fail-closed error when DATABASE_URL is missing")
	}
}

func TestIntegration_AuthAndJWT(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	token, err := auth.GenerateToken(1, "admin@sentinelpulse.local", "org-test-1", "admin", secret, time.Hour)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := auth.ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.OrganizationID != "org-test-1" || claims.Role != "admin" {
		t.Fatalf("Token claims mismatch: %+v", claims)
	}
}
