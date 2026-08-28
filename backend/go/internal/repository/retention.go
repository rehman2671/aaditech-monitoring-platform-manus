package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"
)

type RetentionPolicy struct {
	RetentionDays int
	DryRun        bool
}

func PurgeOldProcessSamples(ctx context.Context, db *sql.DB, tenantID string, policy RetentionPolicy) (int64, error) {
	if strings.TrimSpace(tenantID) == "" {
		return 0, fmt.Errorf("tenant ID is required for process sample purge")
	}
	if policy.RetentionDays <= 0 {
		policy.RetentionDays = 30
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -policy.RetentionDays)
	if policy.DryRun {
		var count int64
		err := db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM endpoint_process_samples
			WHERE tenant_id = $1 AND captured_at < $2
		`, tenantID, cutoff).Scan(&count)
		log.Printf("[Retention] DRY-RUN: Would purge %d process samples for tenant %s older than %s", count, tenantID, cutoff.Format(time.RFC3339))
		return count, err
	}
	res, err := db.ExecContext(ctx, `
		DELETE FROM endpoint_process_samples
		WHERE tenant_id = $1 AND captured_at < $2
	`, tenantID, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to purge process samples: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to retrieve deleted process sample count: %w", err)
	}
	log.Printf("[Retention] Successfully purged %d process samples for tenant %s older than %s", rowsAffected, tenantID, cutoff.Format(time.RFC3339))
	return rowsAffected, nil
}

func PurgeOldAuditLogs(ctx context.Context, db *sql.DB, tenantID string, policy RetentionPolicy) (int64, error) {
	if strings.TrimSpace(tenantID) == "" {
		return 0, fmt.Errorf("tenant ID is required for audit log purge")
	}
	if policy.RetentionDays <= 0 {
		policy.RetentionDays = 90 // Default 90-day retention for compliance
	}

	cutoff := time.Now().AddDate(0, 0, -policy.RetentionDays)

	if policy.DryRun {
		var count int64
		err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND created_at < $2", tenantID, cutoff).Scan(&count)
		log.Printf("[Retention] DRY-RUN: Would purge %d audit logs for tenant %s older than %s (cutoff: %s)", count, tenantID, cutoff.Format(time.RFC3339), cutoff)

		return count, err
	}

	res, err := db.ExecContext(ctx, "DELETE FROM audit_logs WHERE tenant_id = $1 AND created_at < $2", tenantID, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to purge audit logs: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to retrieve deleted audit log count: %w", err)
	}

	log.Printf("[Retention] Successfully purged %d audit logs for tenant %s older than %s (cutoff: %s)", rowsAffected, tenantID, cutoff.Format(time.RFC3339), cutoff)
	return rowsAffected, nil
}
