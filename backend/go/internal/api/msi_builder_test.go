package api

import (
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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
	if valid.IsZero() || valid.Year() != 2026 {
		t.Fatalf("expected valid RFC3339 timestamp, got %v", valid)
	}
	invalid := parseTime("not-a-timestamp")
	if invalid.Unix() != 0 {
		t.Fatalf("expected invalid timestamp to map to Unix epoch, got %v", invalid)
	}
}

func TestRequireAdmin(t *testing.T) {
	adminRequest := httptest.NewRequest("GET", "/", nil).WithContext(context.WithValue(context.Background(), "claims", &auth.Claims{Role: "admin"}))
	adminWriter := httptest.NewRecorder()
	if !requireAdmin(adminWriter, adminRequest) {
		t.Fatal("expected admin request to pass")
	}
	if adminWriter.Code != 200 {
		t.Fatalf("expected no response to be written for admin, got %d", adminWriter.Code)
	}

	viewerRequest := httptest.NewRequest("GET", "/", nil).WithContext(context.WithValue(context.Background(), "claims", &auth.Claims{Role: "viewer"}))
	viewerWriter := httptest.NewRecorder()
	if requireAdmin(viewerWriter, viewerRequest) {
		t.Fatal("expected viewer request to be rejected")
	}
	if viewerWriter.Code != 403 {
		t.Fatalf("expected 403 for viewer, got %d", viewerWriter.Code)
	}
}

func TestBuilderUnavailableMessage(t *testing.T) {
	if got := builderUnavailableMessage(""); got == "" {
		t.Fatal("expected actionable message for missing builder key")
	}
	if got := builderUnavailableMessage("configured"); got == "" {
		t.Fatal("expected actionable message for offline builder")
	}
	if parseTime(time.Now().UTC().Format(time.RFC3339Nano)).IsZero() {
		t.Fatal("expected current UTC time to parse")
	}
}

func TestDownloadLatestServesNewestMsiToAdmin(t *testing.T) {
	artifactDir := t.TempDir()
	oldPath := filepath.Join(artifactDir, "SentinelPulseAgent-2.4.1-x64.msi")
	newPath := filepath.Join(artifactDir, "SentinelPulseAgent-2.4.2-x64.msi")
	if err := os.WriteFile(oldPath, []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	time.Sleep(10 * time.Millisecond)
	if err := os.WriteFile(newPath, []byte("new"), 0600); err != nil {
		t.Fatal(err)
	}

	handler := NewMSIBuildHandler(nil, artifactDir, "configured")
	req := httptest.NewRequest("GET", "/api/v1/admin/msi-latest/download", nil).WithContext(context.WithValue(context.Background(), "claims", &auth.Claims{Role: "admin"}))
	writer := httptest.NewRecorder()
	handler.DownloadLatest(writer, req)
	if writer.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", writer.Code, writer.Body.String())
	}
	if !strings.Contains(writer.Header().Get("Content-Disposition"), "SentinelPulseAgent-2.4.2-x64.msi") {
		t.Fatalf("unexpected content disposition: %s", writer.Header().Get("Content-Disposition"))
	}
	if writer.Body.String() != "new" {
		t.Fatalf("expected newest MSI body, got %q", writer.Body.String())
	}
}

func TestAutomaticEnrollmentValidation(t *testing.T) {
	validURLs := []string{"http://127.0.0.1:8080", "https://monitoring.example.test/api"}
	for _, value := range validURLs {
		if !validBootstrapURL(value) {
			t.Errorf("expected bootstrap URL %q to be accepted", value)
		}
	}
	invalidURLs := []string{"", "127.0.0.1:8080", "ftp://example.test", "http://user:pass@example.test"}
	for _, value := range invalidURLs {
		if validBootstrapURL(value) {
			t.Errorf("expected bootstrap URL %q to be rejected", value)
		}
	}
	if !validEndpointID("DESKTOP-1E02MC9") {
		t.Fatal("expected normal Windows endpoint name to be accepted")
	}
	if validEndpointID("DESKTOP NAME") || validEndpointID("") {
		t.Fatal("expected blank and whitespace endpoint names to be rejected")
	}
}

func TestEnrollmentTokenFormat(t *testing.T) {
	valid := "sp-enrol-11111111-1111-1111-1111-111111111111"
	if !enrollmentTokenPattern.MatchString(valid) {
		t.Fatal("expected canonical enrollment token to be accepted")
	}
	for _, invalid := range []string{
		"sp-enrol-fac58fa799d2d8f4014d22c2507320f6d3057453d15f21bda1f0dfda76883d5",
		"sp-enrol-11111111111111111111111111111111",
		"sp_enrol_11111111-1111-1111-1111-111111111111",
	} {
		if enrollmentTokenPattern.MatchString(invalid) {
			t.Errorf("expected malformed token %q to be rejected", invalid)
		}
	}
}
