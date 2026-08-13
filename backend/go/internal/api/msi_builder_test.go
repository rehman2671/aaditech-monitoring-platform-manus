package api

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sentinelpulse/backend/internal/auth"
)

func TestMSIVersionPattern(t *testing.T) {
	valid := []string{"2.4.2", "10.0.1", "2.4.2-beta.1", "2.4.2+build.7"}
	for _, value := range valid {
		if !semverPattern.MatchString(value) {
			t.Errorf("expected %q to be accepted as semantic version", value)
		}
	}
	invalid := []string{"2.4", "v2.4.2", "2.4.2.1", "2.04.2", "2.4.2/../../x", ""}
	for _, value := range invalid {
		if semverPattern.MatchString(value) {
			t.Errorf("expected %q to be rejected as semantic version", value)
		}
	}
}

func TestParseTimeUsesUnixEpochForInvalidInput(t *testing.T) {
	valid := parseTime("2026-08-14T00:00:00.000Z")
	if valid.IsZero() || valid.Year() != 2026 { t.Fatalf("expected valid RFC3339 timestamp, got %v", valid) }
	invalid := parseTime("not-a-timestamp")
	if invalid.Unix() != 0 { t.Fatalf("expected invalid timestamp to map to Unix epoch, got %v", invalid) }
}

func TestRequireAdmin(t *testing.T) {
	adminRequest := httptest.NewRequest("GET", "/", nil).WithContext(context.WithValue(context.Background(), "claims", &auth.Claims{Role: "admin"}))
	adminWriter := httptest.NewRecorder()
	if !requireAdmin(adminWriter, adminRequest) { t.Fatal("expected admin request to pass") }
	if adminWriter.Code != 200 { t.Fatalf("expected no response to be written for admin, got %d", adminWriter.Code) }

	viewerRequest := httptest.NewRequest("GET", "/", nil).WithContext(context.WithValue(context.Background(), "claims", &auth.Claims{Role: "viewer"}))
	viewerWriter := httptest.NewRecorder()
	if requireAdmin(viewerWriter, viewerRequest) { t.Fatal("expected viewer request to be rejected") }
	if viewerWriter.Code != 403 { t.Fatalf("expected 403 for viewer, got %d", viewerWriter.Code) }
}

func TestBuilderUnavailableMessage(t *testing.T) {
	if got := builderUnavailableMessage(""); got == "" { t.Fatal("expected actionable message for missing builder key") }
	if got := builderUnavailableMessage("configured"); got == "" { t.Fatal("expected actionable message for offline builder") }
	if parseTime(time.Now().UTC().Format(time.RFC3339Nano)).IsZero() { t.Fatal("expected current UTC time to parse") }
}
