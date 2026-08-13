package main

import (
	"testing"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
)

func TestIntegration_TenantIsolationContract(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	tokenA, err := auth.GenerateToken(1, "user@org-a.local", "org-a", "admin", secret, time.Hour)
	if err != nil {
		t.Fatalf("Failed to generate token A: %v", err)
	}

	claimsA, err := auth.ValidateToken(tokenA, secret)
	if err != nil || claimsA.OrganizationID != "org-a" {
		t.Fatalf("Tenant isolation failure for Org A: %v", err)
	}

	tokenB, err := auth.GenerateToken(2, "user@org-b.local", "org-b", "admin", secret, time.Hour)
	if err != nil {
		t.Fatalf("Failed to generate token B: %v", err)
	}

	claimsB, err := auth.ValidateToken(tokenB, secret)
	if err != nil || claimsB.OrganizationID != "org-b" {
		t.Fatalf("Tenant isolation failure for Org B: %v", err)
	}

	if claimsA.OrganizationID == claimsB.OrganizationID {
		t.Fatalf("Cross-tenant isolation collision detected")
	}
}
