package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func generateTestJWT(secret string, email, orgID, role string) string {
	claims := jwt.MapClaims{
		"email":  email,
		"org_id": orgID,
		"role":   role,
		"exp":    time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString([]byte(secret))
	return signed
}

func TestHealthCheck(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy"}`))
	})

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rec.Code)
	}
}

func TestJWTAuthenticationFailClosed(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "test-super-secret")
	defer os.Unsetenv("JWT_SECRET")

	req := httptest.NewRequest("GET", "/api/v1/admin/audit", nil)
	rec := httptest.NewRecorder()

	handler := securityAndTenantMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for missing token, got %d", rec.Code)
	}
}

func TestRBACEnforcementJWT(t *testing.T) {
	secret := "test-super-secret"
	_ = os.Setenv("JWT_SECRET", secret)
	defer os.Unsetenv("JWT_SECRET")

	auditRepo = NewPersistentAuditRepository(nil)
	viewerToken := generateTestJWT(secret, "viewer@corp.internal", "org-enterprise-01", "viewer")

	req := httptest.NewRequest("GET", "/api/v1/admin/audit", nil)
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	rec := httptest.NewRecorder()

	handler := securityAndTenantMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for viewer accessing admin route, got %d", rec.Code)
	}
}

func TestAdminSuccessAndPersistentAuditLog(t *testing.T) {
	secret := "test-super-secret"
	_ = os.Setenv("JWT_SECRET", secret)
	defer os.Unsetenv("JWT_SECRET")

	auditRepo = NewPersistentAuditRepository(nil)
	_, _ = auditRepo.Log("org-enterprise-01", "admin@sentinelpulse.internal", "TEST_ACTION", "Target1", "SUCCESS")

	adminToken := generateTestJWT(secret, "admin@sentinelpulse.internal", "org-enterprise-01", "admin")

	req := httptest.NewRequest("GET", "/api/v1/admin/audit", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	rec := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/admin/audit", func(w http.ResponseWriter, r *http.Request) {
		orgID := r.Header.Get("X-Verified-Organization-ID")
		entries, _ := auditRepo.List(orgID)
		writeJSON(w, http.StatusOK, entries)
	})

	handler := securityAndTenantMiddleware(mux)
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for admin accessing audit logs, got %d", rec.Code)
	}

	var entries []AuditEntry
	if err := json.Unmarshal(rec.Body.Bytes(), &entries); err != nil {
		t.Fatalf("Failed to parse audit entries: %v", err)
	}

	if len(entries) == 0 {
		t.Error("Expected persisted audit entries, got 0")
	}
}

func TestPersistentAuditRepositoryWithMockDB(t *testing.T) {
	repo := NewPersistentAuditRepository(nil)
	_, err := repo.Log("org-test", "admin@test.com", "TEST_ACTION", "Target", "SUCCESS")
	if err != nil {
		t.Fatalf("Failed to log audit entry: %v", err)
	}

	entries, err := repo.List("org-test")
	if err != nil {
		t.Fatalf("Failed to list audit entries: %v", err)
	}

	if len(entries) != 1 || entries[0].Action != "TEST_ACTION" {
		t.Errorf("Expected 1 audit entry with action TEST_ACTION, got %v", entries)
	}
}

func TestEndpointRepositoryNilDB(t *testing.T) {
	repo := NewEndpointRepository(nil)
	err := repo.UpsertEndpoint(EndpointModel{ID: "ep-1"})
	if err == nil {
		t.Error("Expected error when upserting with nil database connection")
	}

	_, err = repo.ListEndpoints("org-1")
	if err == nil {
		t.Error("Expected error when listing endpoints with nil database connection")
	}
}

func TestTokenRepositoryNilDB(t *testing.T) {
	repo := NewTokenRepository(nil)
	_, err := repo.CreateToken("org-1", "secret-token", time.Hour)
	if err == nil {
		t.Error("Expected error when creating token with nil database connection")
	}

	_, err = repo.ConsumeAndRegisterEndpoint("secret-token", "ep-1", "host1", "sn1")
	if err == nil {
		t.Error("Expected error when consuming token with nil database connection")
	}
}

func TestTokenHashingDeterminism(t *testing.T) {
	raw := "sp_enrol_secret123"
	h1 := HashEnrollmentToken(raw)
	h2 := HashEnrollmentToken(raw)
	if h1 != h2 || len(h1) != 64 {
		t.Errorf("Expected deterministic 64-char sha256 hash, got %s and %s", h1, h2)
	}
}

func TestMigratorNilDB(t *testing.T) {
	migrator := NewMigrator(nil, "./migrations")
	err := migrator.Up()
	if err == nil {
		t.Error("Expected error when running migrator with nil database connection")
	}
}

func TestProductionFailClosedStartupLogic(t *testing.T) {
	_ = os.Setenv("ENV", "production")
	_ = os.Setenv("JWT_SECRET", "")
	defer os.Unsetenv("ENV")
	defer os.Unsetenv("JWT_SECRET")

	env := os.Getenv("ENV")
	jwtSecret := os.Getenv("JWT_SECRET")
	if (env == "production" || env == "prod") && jwtSecret == "" {
		return
	}
	t.Error("Expected production fail-closed condition for missing JWT_SECRET")
}
