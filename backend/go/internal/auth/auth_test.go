package auth

import (
	"strings"
	"testing"
	"time"
)

func TestPasswordHashAndCheck(t *testing.T) {
	hash, err := HashPassword("CorrectHorseBatteryStaple!")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "CorrectHorseBatteryStaple!" || !strings.HasPrefix(hash, "$2") {
		t.Fatalf("password was not stored as a bcrypt hash: %q", hash)
	}
	if !CheckPassword("CorrectHorseBatteryStaple!", hash) {
		t.Fatal("expected the original password to validate")
	}
	if CheckPassword("wrong-password", hash) {
		t.Fatal("expected an incorrect password to fail")
	}
}

func TestHS256TokenRejectsTampering(t *testing.T) {
	token, err := GenerateToken(7, "admin@example.test", "org-1", "admin", strings.Repeat("s", 32), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ValidateToken(token, strings.Repeat("s", 32))
	if err != nil || claims.OrganizationID != "org-1" {
		t.Fatalf("expected valid token claims, got claims=%v err=%v", claims, err)
	}
	tampered := token[:len(token)-1] + "x"
	if _, err := ValidateToken(tampered, strings.Repeat("s", 32)); err == nil {
		t.Fatal("expected a tampered token to be rejected")
	}
}
