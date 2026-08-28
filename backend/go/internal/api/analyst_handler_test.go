package api

import (
	"database/sql"
	"encoding/json"
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

func TestAnalystHandlerPersistsValidatedAssessmentForTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT hostname, status, status_reason, last_seen`).
		WithArgs("endpoint-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"hostname", "status", "status_reason", "last_seen"}).AddRow("DESKTOP-1", "online", "authenticated telemetry", nil))
	mock.ExpectQuery(`SELECT captured_at, cpu_utilization, ram_utilization, disk_utilization, temperature_c`).
		WithArgs("tenant-1", "endpoint-1").WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(`SELECT captured_at, pid, name, executable_path, signature, cpu_percent, working_set_bytes, availability`).
		WithArgs("tenant-1", "endpoint-1").
		WillReturnRows(sqlmock.NewRows([]string{"captured_at", "pid", "name", "executable_path", "signature", "cpu_percent", "working_set_bytes", "availability"}))

	ollamaServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		content := `{"overall_risk":"LOW","confidence":0.8,"summary":"No actionable issue is established from the supplied evidence.","findings":[],"positive_findings":[],"data_quality_issues":["No metric sample is available."],"recommended_steps":["Wait for the next scheduled sample."]}`
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"message": map[string]string{"content": content}})
	}))
	defer ollamaServer.Close()
	client, err := ollama.NewClient(ollama.Config{Provider: "ollama", BaseURL: ollamaServer.URL}, ollamaServer.Client())
	if err != nil {
		t.Fatal(err)
	}

	mock.ExpectExec(`INSERT INTO analyst_assessments`).
		WithArgs("tenant-1", "endpoint-1", sqlmock.AnyArg(), "ollama", "qwen3:1.7b", sqlmock.AnyArg(), true, "", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	handler := NewAnalystHandler(db, client)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/endpoints/endpoint-1/analyst", nil)
	resp := httptest.NewRecorder()
	handler.Analyze(resp, req, &auth.Claims{OrganizationID: "tenant-1"}, "endpoint-1")
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"persisted":true`) {
		t.Fatalf("expected persisted analyst response, got %d: %s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
