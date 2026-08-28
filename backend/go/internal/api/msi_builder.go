package api

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sentinelpulse/backend/internal/auth"
)

var semverPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$`)

const (
	signModeTrusted      = "trusted"
	signModeSelfTest     = "self_signed_test"
	signModeUnsignedTest = "unsigned_test"
)

type MSIBuildHandler struct {
	db          *sql.DB
	artifactDir string
	builderKey  string
}

func NewMSIBuildHandler(db *sql.DB, artifactDir, builderKey string) *MSIBuildHandler {
	return &MSIBuildHandler{db: db, artifactDir: artifactDir, builderKey: builderKey}
}

type msiBuildRequest struct {
	AgentVersion        string `json:"agent_version"`
	SignMode            string `json:"sign_mode"`
	APIBaseURL          string `json:"api_base_url"`
	EndpointID          string `json:"endpoint_id"`
	AutomaticEnrollment bool   `json:"automatic_enrollment"`
}

type msiBuildJob struct {
	ID                    string  `json:"id"`
	OrganizationID        string  `json:"organization_id"`
	AgentVersion          string  `json:"agent_version"`
	SignMode              string  `json:"sign_mode"`
	AutomaticEnrollment   bool    `json:"automatic_enrollment"`
	Status                string  `json:"status"`
	ErrorMessage          *string `json:"error_message,omitempty"`
	ArtifactFilename      *string `json:"artifact_filename,omitempty"`
	ChecksumFilename      *string `json:"checksum_filename,omitempty"`
	SHA256                *string `json:"sha256,omitempty"`
	IsSigned              bool    `json:"is_signed"`
	CertificateSubject    *string `json:"certificate_subject,omitempty"`
	CertificateThumbprint *string `json:"certificate_thumbprint,omitempty"`
	CertificateExpiresAt  *string `json:"certificate_expires_at,omitempty"`
	CertificateTrusted    bool    `json:"certificate_trusted"`
	SizeBytes             int64   `json:"size_bytes"`
	CreatedAt             string  `json:"created_at"`
	StartedAt             *string `json:"started_at,omitempty"`
	CompletedAt           *string `json:"completed_at,omitempty"`
}

type msiBuildClaim struct {
	msiBuildJob
	BootstrapAPIBaseURL      string `json:"bootstrap_api_base_url,omitempty"`
	BootstrapEndpointID      string `json:"bootstrap_endpoint_id,omitempty"`
	BootstrapEnrollmentToken string `json:"bootstrap_enrollment_token,omitempty"`
}

type msiBuilderStatus struct {
	Available             bool    `json:"available"`
	BuilderID             *string `json:"builder_id,omitempty"`
	LastSeenAt            *string `json:"last_seen_at,omitempty"`
	SigningMode           string  `json:"signing_mode"`
	CertificateSubject    *string `json:"certificate_subject,omitempty"`
	CertificateThumbprint *string `json:"certificate_thumbprint,omitempty"`
	CertificateExpiresAt  *string `json:"certificate_expires_at,omitempty"`
	CertificateTrusted    bool    `json:"certificate_trusted"`
	Message               string  `json:"message"`
}

type msiBuilderHeartbeat struct {
	BuilderID             string  `json:"builder_id"`
	SigningMode           string  `json:"signing_mode"`
	CertificateSubject    *string `json:"certificate_subject,omitempty"`
	CertificateThumbprint *string `json:"certificate_thumbprint,omitempty"`
	CertificateExpiresAt  *string `json:"certificate_expires_at,omitempty"`
	CertificateTrusted    bool    `json:"certificate_trusted"`
}

type msiBuildStatusUpdate struct {
	JobID                 string  `json:"job_id"`
	Status                string  `json:"status"`
	ErrorMessage          *string `json:"error_message,omitempty"`
	ArtifactFilename      *string `json:"artifact_filename,omitempty"`
	ChecksumFilename      *string `json:"checksum_filename,omitempty"`
	SHA256                *string `json:"sha256,omitempty"`
	IsSigned              bool    `json:"is_signed"`
	CertificateSubject    *string `json:"certificate_subject,omitempty"`
	CertificateThumbprint *string `json:"certificate_thumbprint,omitempty"`
	CertificateExpiresAt  *string `json:"certificate_expires_at,omitempty"`
	CertificateTrusted    bool    `json:"certificate_trusted"`
	SizeBytes             int64   `json:"size_bytes"`
}

func (h *MSIBuildHandler) AdminStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	if !requireAdmin(w, r) {
		return
	}

	var status msiBuilderStatus
	var builderID, lastSeen, subject, thumbprint, expires sql.NullString
	var trusted bool
	err := h.db.QueryRowContext(r.Context(), `
		SELECT builder_id,
		       to_char(last_seen_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       signing_mode, certificate_subject, certificate_thumbprint,
		       to_char(certificate_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), certificate_trusted
		FROM msi_builder_status WHERE id = 1`).Scan(&builderID, &lastSeen, &status.SigningMode, &subject, &thumbprint, &expires, &trusted)
	if errors.Is(err, sql.ErrNoRows) {
		status = msiBuilderStatus{Available: false, SigningMode: "unconfigured", Message: builderUnavailableMessage(h.builderKey)}
		writeJSON(w, http.StatusOK, status)
		return
	}
	if err != nil {
		http.Error(w, "Failed to read MSI builder status", http.StatusInternalServerError)
		return
	}

	status.Available = h.builderKey != "" && lastSeen.Valid && time.Since(parseTime(lastSeen.String)) < 5*time.Minute
	status.BuilderID = nullStringPtr(builderID)
	status.LastSeenAt = nullStringPtr(lastSeen)
	status.CertificateSubject = nullStringPtr(subject)
	status.CertificateThumbprint = nullStringPtr(thumbprint)
	status.CertificateExpiresAt = nullStringPtr(expires)
	status.CertificateTrusted = trusted
	status.Message = "Windows build runner is offline"
	if status.Available {
		status.Message = "Windows build runner is online"
	}
	writeJSON(w, http.StatusOK, status)
}

func (h *MSIBuildHandler) ListOrCreate(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	switch r.Method {
	case http.MethodGet:
		h.listBuilds(w, r)
	case http.MethodPost:
		h.createBuild(w, r)
	default:
		methodNotAllowed(w)
	}
}

func (h *MSIBuildHandler) createBuild(w http.ResponseWriter, r *http.Request) {
	var req msiBuildRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}
	req.AgentVersion = strings.TrimSpace(req.AgentVersion)
	if !semverPattern.MatchString(req.AgentVersion) {
		http.Error(w, "agent_version must be semantic version x.y.z", http.StatusBadRequest)
		return
	}
	if req.SignMode == "" {
		req.SignMode = signModeTrusted
	}
	if req.SignMode != signModeTrusted && req.SignMode != signModeSelfTest && req.SignMode != signModeUnsignedTest {
		http.Error(w, "Unsupported sign_mode", http.StatusBadRequest)
		return
	}
	if req.SignMode == signModeTrusted && h.builderKey == "" {
		http.Error(w, "Windows builder is not configured; production signing is unavailable", http.StatusServiceUnavailable)
		return
	}

	if req.AutomaticEnrollment {
		if !validBootstrapURL(req.APIBaseURL) {
			http.Error(w, "api_base_url must be an absolute http(s) URL", http.StatusBadRequest)
			return
		}
		req.APIBaseURL = strings.TrimRight(strings.TrimSpace(req.APIBaseURL), "/")
		if !validEndpointID(req.EndpointID) {
			http.Error(w, "endpoint_id must be non-empty and contain no whitespace", http.StatusBadRequest)
			return
		}
	}

	claims := claimsFromRequest(r)
	jobID := uuid.NewString()
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		http.Error(w, "Failed to start MSI build transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var rawToken string
	if req.AutomaticEnrollment {
		rawToken = "sp-enrol-" + uuid.New().String()
		expiresAt := time.Now().Add(24 * time.Hour)
		if _, err = tx.ExecContext(r.Context(), `
			INSERT INTO enrollment_tokens (token_hash, tenant_id, expires_at, created_at)
			VALUES ($1, $2, $3, NOW())`, hashToken(rawToken), claims.OrganizationID, expiresAt); err != nil {
			http.Error(w, "Failed to persist automatic enrollment token", http.StatusInternalServerError)
			return
		}
	}

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO msi_build_jobs (id, tenant_id, requested_by, agent_version, sign_mode, status,
			automatic_enrollment, bootstrap_api_base_url, bootstrap_endpoint_id, bootstrap_enrollment_token)
		VALUES ($1, $2, $3, $4, $5, 'pending', $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''))`,
		jobID, claims.OrganizationID, claims.UserID, req.AgentVersion, req.SignMode,
		req.AutomaticEnrollment, req.APIBaseURL, req.EndpointID, rawToken)
	if err != nil {
		http.Error(w, "Failed to queue MSI build: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit MSI build transaction", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"job_id": jobID, "status": "pending", "automatic_enrollment": req.AutomaticEnrollment, "message": "Build queued for the Windows runner"})
}

func (h *MSIBuildHandler) listBuilds(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromRequest(r)
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, tenant_id, agent_version, sign_mode, automatic_enrollment, status, error_message, artifact_filename,
		       checksum_filename, sha256, is_signed, certificate_subject, certificate_thumbprint,
		       to_char(certificate_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), certificate_trusted, size_bytes,
		       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
		FROM msi_build_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`, claims.OrganizationID)
	if err != nil {
		http.Error(w, "Failed to list MSI builds", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	jobs := make([]msiBuildJob, 0)
	for rows.Next() {
		job, err := scanMSIBuild(rows)
		if err != nil {
			http.Error(w, "Failed to decode MSI build record", http.StatusInternalServerError)
			return
		}
		jobs = append(jobs, job)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read MSI builds", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (h *MSIBuildHandler) Detail(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/msi-builds/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	jobID := parts[0]
	if len(parts) == 2 && (parts[1] == "download" || parts[1] == "manifest") {
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		if parts[1] == "download" {
			h.download(w, r, jobID)
		} else {
			h.downloadManifest(w, r, jobID)
		}
		return
	}
	if len(parts) != 1 || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	claims := claimsFromRequest(r)
	job, err := h.getBuild(r, jobID, claims.OrganizationID)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "Failed to read MSI build", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

// DownloadLatest serves the newest MSI already present in the shared artifact directory.
// It is separate from job downloads so an existing verified artifact remains
// downloadable even when the job history is empty or was migrated.
func (h *MSIBuildHandler) DownloadLatest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	if !requireAdmin(w, r) {
		return
	}
	entries, err := os.ReadDir(h.artifactDir)
	if err != nil {
		http.Error(w, "MSI artifact directory is unavailable", http.StatusNotFound)
		return
	}
	var newest os.FileInfo
	var newestName string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".msi") {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		if newest == nil || info.ModTime().After(newest.ModTime()) {
			newest = info
			newestName = filepath.Base(entry.Name())
		}
	}
	if newest == nil {
		http.Error(w, "No compiled MSI artifact is available", http.StatusNotFound)
		return
	}
	file, err := os.Open(filepath.Join(h.artifactDir, newestName))
	if err != nil {
		http.Error(w, "MSI artifact is not present on the Windows host", http.StatusNotFound)
		return
	}
	defer file.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, newestName))
	http.ServeContent(w, r, newestName, newest.ModTime(), file)
}

func (h *MSIBuildHandler) downloadManifest(w http.ResponseWriter, r *http.Request, jobID string) {
	claims := claimsFromRequest(r)
	job, err := h.getBuild(r, jobID, claims.OrganizationID)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "Failed to read MSI build", http.StatusInternalServerError)
		return
	}
	if job.Status != "succeeded" || job.ChecksumFilename == nil {
		http.Error(w, "MSI checksum manifest is not available", http.StatusConflict)
		return
	}
	filename := filepath.Base(*job.ChecksumFilename)
	if filename != *job.ChecksumFilename || !strings.HasSuffix(strings.ToLower(filename), ".sha256") {
		http.Error(w, "Invalid checksum filename", http.StatusInternalServerError)
		return
	}
	path := filepath.Join(h.artifactDir, filename)
	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "MSI checksum manifest is not present on the Windows host", http.StatusNotFound)
		return
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Failed to inspect MSI checksum manifest", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeContent(w, r, filename, stat.ModTime(), file)
}

func (h *MSIBuildHandler) download(w http.ResponseWriter, r *http.Request, jobID string) {
	claims := claimsFromRequest(r)
	job, err := h.getBuild(r, jobID, claims.OrganizationID)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "Failed to read MSI build", http.StatusInternalServerError)
		return
	}
	if job.Status != "succeeded" || job.ArtifactFilename == nil {
		http.Error(w, "MSI artifact is not available", http.StatusConflict)
		return
	}

	filename := filepath.Base(*job.ArtifactFilename)
	if filename != *job.ArtifactFilename || !strings.HasSuffix(strings.ToLower(filename), ".msi") {
		http.Error(w, "Invalid artifact filename", http.StatusInternalServerError)
		return
	}
	path := filepath.Join(h.artifactDir, filename)
	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "MSI artifact is not present on the Windows host", http.StatusNotFound)
		return
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "Failed to inspect MSI artifact", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeContent(w, r, filename, stat.ModTime(), file)
}

func (h *MSIBuildHandler) InternalHeartbeat(w http.ResponseWriter, r *http.Request) {
	if !h.authorizeBuilder(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req msiBuilderHeartbeat
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.BuilderID) == "" {
		http.Error(w, "Invalid builder heartbeat", http.StatusBadRequest)
		return
	}
	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO msi_builder_status (id, builder_id, last_seen_at, signing_mode, certificate_subject,
		 certificate_thumbprint, certificate_expires_at, certificate_trusted)
		VALUES (1, $1, NOW(), $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET builder_id = EXCLUDED.builder_id, last_seen_at = NOW(),
		 signing_mode = EXCLUDED.signing_mode, certificate_subject = EXCLUDED.certificate_subject,
		 certificate_thumbprint = EXCLUDED.certificate_thumbprint, certificate_expires_at = EXCLUDED.certificate_expires_at,
		 certificate_trusted = EXCLUDED.certificate_trusted`, req.BuilderID, req.SigningMode, req.CertificateSubject,
		req.CertificateThumbprint, req.CertificateExpiresAt, req.CertificateTrusted)
	if err != nil {
		log.Printf("msi builder heartbeat persistence failed for builder %s: %v", req.BuilderID, err)
		http.Error(w, "Failed to record builder heartbeat", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MSIBuildHandler) InternalNext(w http.ResponseWriter, r *http.Request) {
	if !h.authorizeBuilder(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	ctx := r.Context()
	// A crashed Windows runner can leave a claimed job in running forever.
	// Requeue only claims older than the bounded lease so active builds are not interrupted.
	if _, requeueErr := h.db.ExecContext(ctx, `
		UPDATE msi_build_jobs
		SET status = 'pending', started_at = NULL, error_message = 'Requeued after the Windows builder lease expired'
		WHERE status = 'running' AND started_at < NOW() - INTERVAL '15 minutes'`); requeueErr != nil {
		log.Printf("msi builder stale-job recovery failed: %v", requeueErr)
	}
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		http.Error(w, "Failed to claim MSI build", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()
	var job msiBuildJob
	var bootstrapAPIBaseURL, bootstrapEndpointID, bootstrapEnrollmentToken sql.NullString
	var errMessage, artifact, checksum, sha, subject, thumbprint, expires, started, completed sql.NullString
	err = tx.QueryRowContext(ctx, `
			SELECT id, tenant_id, agent_version, sign_mode, automatic_enrollment, status,
			       bootstrap_api_base_url, bootstrap_endpoint_id, bootstrap_enrollment_token,
			       error_message, artifact_filename,
		       checksum_filename, sha256, is_signed, certificate_subject, certificate_thumbprint,
		       to_char(certificate_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), certificate_trusted, size_bytes,
		       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
		FROM msi_build_jobs WHERE status = 'pending' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(
		&job.ID, &job.OrganizationID, &job.AgentVersion, &job.SignMode, &job.AutomaticEnrollment, &job.Status,
		&bootstrapAPIBaseURL, &bootstrapEndpointID, &bootstrapEnrollmentToken, &errMessage,
		&artifact, &checksum, &sha, &job.IsSigned, &subject, &thumbprint, &expires, &job.CertificateTrusted,
		&job.SizeBytes, &job.CreatedAt, &started, &completed)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusOK, map[string]any{"job": nil})
		return
	}
	if err != nil {
		log.Printf("msi builder claim query failed: %v", err)
		http.Error(w, "Failed to read pending MSI build", http.StatusInternalServerError)
		return
	}
	job.Status = "running"
	now := time.Now().UTC().Format(time.RFC3339Nano)
	job.StartedAt = &now
	if _, err = tx.ExecContext(ctx, `UPDATE msi_build_jobs SET status = 'running', started_at = NOW() WHERE id = $1`, job.ID); err != nil {
		http.Error(w, "Failed to claim pending MSI build", http.StatusInternalServerError)
		return
	}
	if err = tx.Commit(); err != nil {
		log.Printf("msi builder claim commit failed for job %s: %v", job.ID, err)
		http.Error(w, "Failed to commit MSI build claim", http.StatusInternalServerError)
		return
	}
	claim := msiBuildClaim{
		msiBuildJob:              job,
		BootstrapAPIBaseURL:      nullStringValue(bootstrapAPIBaseURL),
		BootstrapEndpointID:      nullStringValue(bootstrapEndpointID),
		BootstrapEnrollmentToken: nullStringValue(bootstrapEnrollmentToken),
	}
	writeJSON(w, http.StatusOK, map[string]any{"job": claim})
}

func (h *MSIBuildHandler) InternalStatus(w http.ResponseWriter, r *http.Request) {
	if !h.authorizeBuilder(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req msiBuildStatusUpdate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.JobID == "" {
		http.Error(w, "Invalid MSI build status update", http.StatusBadRequest)
		return
	}
	if req.Status != "running" && req.Status != "succeeded" && req.Status != "failed" {
		http.Error(w, "Invalid MSI build status", http.StatusBadRequest)
		return
	}
	_, err := h.db.ExecContext(r.Context(), `
					UPDATE msi_build_jobs SET status = $2::varchar, error_message = $3, artifact_filename = $4,
			 checksum_filename = $5, sha256 = $6, is_signed = $7, certificate_subject = $8,
				 certificate_thumbprint = $9, certificate_expires_at = $10, certificate_trusted = $11,
				 size_bytes = $12,
				 bootstrap_api_base_url = CASE WHEN $2::varchar IN ('succeeded', 'failed') THEN NULL ELSE bootstrap_api_base_url END,
				 bootstrap_endpoint_id = CASE WHEN $2::varchar IN ('succeeded', 'failed') THEN NULL ELSE bootstrap_endpoint_id END,
				 bootstrap_enrollment_token = CASE WHEN $2::varchar IN ('succeeded', 'failed') THEN NULL ELSE bootstrap_enrollment_token END,
				 completed_at = CASE WHEN $2::varchar IN ('succeeded', 'failed') THEN NOW() ELSE completed_at END

		WHERE id = $1`, req.JobID, req.Status, req.ErrorMessage, req.ArtifactFilename, req.ChecksumFilename,
		req.SHA256, req.IsSigned, req.CertificateSubject, req.CertificateThumbprint, req.CertificateExpiresAt,
		req.CertificateTrusted, req.SizeBytes)
	if err != nil {
		log.Printf("msi builder status update failed for job %s: %v", req.JobID, err)
		http.Error(w, "Failed to update MSI build status", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MSIBuildHandler) authorizeBuilder(w http.ResponseWriter, r *http.Request) bool {
	if h.builderKey == "" {
		http.Error(w, "MSI builder is not configured", http.StatusServiceUnavailable)
		return false
	}
	provided := r.Header.Get("X-SentinelPulse-Builder-Key")
	if len(provided) != len(h.builderKey) || subtle.ConstantTimeCompare([]byte(provided), []byte(h.builderKey)) != 1 {
		http.Error(w, "Unauthorized builder", http.StatusUnauthorized)
		return false
	}
	return true
}

func requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	claims := claimsFromRequest(r)
	if claims == nil || claims.Role != "admin" {
		http.Error(w, "Forbidden: Admin role required", http.StatusForbidden)
		return false
	}
	return true
}

func claimsFromRequest(r *http.Request) *auth.Claims {
	claims, _ := r.Context().Value("claims").(*auth.Claims)
	return claims
}

func (h *MSIBuildHandler) getBuild(r *http.Request, id, tenant string) (msiBuildJob, error) {
	var job msiBuildJob
	var errMessage, artifact, checksum, sha, subject, thumbprint, expires, started, completed sql.NullString
	err := h.db.QueryRowContext(r.Context(), `
		SELECT id, tenant_id, agent_version, sign_mode, automatic_enrollment, status, error_message, artifact_filename,
		       checksum_filename, sha256, is_signed, certificate_subject, certificate_thumbprint,
		       to_char(certificate_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), certificate_trusted, size_bytes,
		       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
		       to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
		FROM msi_build_jobs WHERE id = $1 AND tenant_id = $2`, id, tenant).Scan(
		&job.ID, &job.OrganizationID, &job.AgentVersion, &job.SignMode, &job.AutomaticEnrollment, &job.Status, &errMessage,
		&artifact, &checksum, &sha, &job.IsSigned, &subject, &thumbprint, &expires, &job.CertificateTrusted,
		&job.SizeBytes, &job.CreatedAt, &started, &completed)
	if err != nil {
		return job, err
	}
	job.ErrorMessage = nullStringPtr(errMessage)
	job.ArtifactFilename = nullStringPtr(artifact)
	job.ChecksumFilename = nullStringPtr(checksum)
	job.SHA256 = nullStringPtr(sha)
	job.CertificateSubject = nullStringPtr(subject)
	job.CertificateThumbprint = nullStringPtr(thumbprint)
	job.CertificateExpiresAt = nullStringPtr(expires)
	job.StartedAt = nullStringPtr(started)
	job.CompletedAt = nullStringPtr(completed)
	return job, nil
}

func scanMSIBuild(scanner interface{ Scan(...any) error }) (msiBuildJob, error) {
	var job msiBuildJob
	var errMessage, artifact, checksum, sha, subject, thumbprint, expires, started, completed sql.NullString
	err := scanner.Scan(&job.ID, &job.OrganizationID, &job.AgentVersion, &job.SignMode, &job.AutomaticEnrollment, &job.Status, &errMessage,
		&artifact, &checksum, &sha, &job.IsSigned, &subject, &thumbprint, &expires, &job.CertificateTrusted,
		&job.SizeBytes, &job.CreatedAt, &started, &completed)
	if err != nil {
		return job, err
	}
	job.ErrorMessage = nullStringPtr(errMessage)
	job.ArtifactFilename = nullStringPtr(artifact)
	job.ChecksumFilename = nullStringPtr(checksum)
	job.SHA256 = nullStringPtr(sha)
	job.CertificateSubject = nullStringPtr(subject)
	job.CertificateThumbprint = nullStringPtr(thumbprint)
	job.CertificateExpiresAt = nullStringPtr(expires)
	job.StartedAt = nullStringPtr(started)
	job.CompletedAt = nullStringPtr(completed)
	return job, nil
}

func nullStringPtr(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func parseTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Unix(0, 0)
	}
	return parsed
}

func validBootstrapURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	return err == nil && parsed.Host != "" && parsed.User == nil && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func validEndpointID(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && len(value) <= 255 && !strings.ContainsAny(value, "\\t\\r\\n ")
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func builderUnavailableMessage(key string) string {
	if key == "" {
		return "Configure MSI_BUILDER_KEY and start the Windows build runner."
	}
	return "Windows build runner has not sent a heartbeat yet."
}

func methodNotAllowed(w http.ResponseWriter) {
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
