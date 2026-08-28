package api

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/sentinelpulse/backend/internal/auth"
	"github.com/sentinelpulse/backend/internal/ollama"
)

func TestAnalystHandlerBuildsTenantScopedUnavailableSnapshot(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT hostname, status, status_reason, last_seen`).
		WithArgs("endpoint-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"hostname", "status", "status_reason", "last_seen"}).
			AddRow("DESKTOP-1", "online", "authenticated telemetry", nil))
	mock.ExpectQuery(`SELECT captured_at, cpu_utilization, ram_utilization, disk_utilization, temperature_c`).
		WithArgs("tenant-1", "endpoint-1").
		WillReturnError(sqlmock.ErrCancelled)
	mock.ExpectQuery(`SELECT captured_at, pid, name, executable_path, signature, cpu_percent, working_set_bytes, availability`).
		WithArgs("tenant-1", "endpoint-1").
		WillReturnRows(sqlmock.NewRows([]string{"captured_at", "pid", "name", "executable_path", "signature", "cpu_percent", "working_set_bytes", "availability"}))

	client, err := ollama.NewClient(ollama.Config{Provider: "disabled"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewAnalystHandler(db, client)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/endpoints/endpoint-1/analyst", nil)
	resp := httptest.NewRecorder()
	handler.Analyze(resp, req, &auth.Claims{OrganizationID: "tenant-1"}, "endpoint-1")
	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected query failure to be explicit, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestAnalystHandlerReturnsUnavailableWhenNoAnalystProviderIsConfigured(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT hostname, status, status_reason, last_seen`).
		WithArgs("endpoint-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"hostname", "status", "status_reason", "last_seen"}).
			AddRow("DESKTOP-1", "online", "authenticated telemetry", nil))
	mock.ExpectQuery(`SELECT captured_at, cpu_utilization, ram_utilization, disk_utilization, temperature_c`).
		WithArgs("tenant-1", "endpoint-1").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`SELECT captured_at, pid, name, executable_path, signature, cpu_percent, working_set_bytes, availability`).
		WithArgs("tenant-1", "endpoint-1").
		WillReturnRows(sqlmock.NewRows([]string{"captured_at", "pid", "name", "executable_path", "signature", "cpu_percent", "working_set_bytes", "availability"}))

	client, err := ollama.NewClient(ollama.Config{Provider: "disabled"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewAnalystHandler(db, client)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/endpoints/endpoint-1/analyst", nil)
	resp := httptest.NewRecorder()
	handler.Analyze(resp, req, &auth.Claims{OrganizationID: "tenant-1"}, "endpoint-1")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected success with truthful unavailable AI state, got %d: %s", resp.Code, resp.Body.String())
	}
	body := resp.Body.String()
	if !strings.Contains(body, `"available":false`) || !strings.Contains(body, "AI analysis disabled") {
		t.Fatalf("expected explicit unavailable state, got %s", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestAnalystHandlerDoesNotResolveEndpointAcrossTenants(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery(`SELECT hostname, status, status_reason, last_seen`).
		WithArgs("endpoint-1", "tenant-2").
		WillReturnError(sql.ErrNoRows)

	client, err := ollama.NewClient(ollama.Config{Provider: "disabled"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewAnalystHandler(db, client)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/endpoints/endpoint-1/analyst", nil)
	resp := httptest.NewRecorder()
	handler.Analyze(resp, req, &auth.Claims{OrganizationID: "tenant-2"}, "endpoint-1")
	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected tenant-mismatched endpoint to be hidden, got %d", resp.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
