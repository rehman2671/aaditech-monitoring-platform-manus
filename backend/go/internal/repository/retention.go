package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

type RetentionPolicy struct {
	RetentionDays int
	DryRun        bool
}

func PurgeOldAuditLogs(ctx context.Context, db *sql.DB, policy RetentionPolicy) (int64, error) {
	if policy.RetentionDays <= 0 {
		policy.RetentionDays = 90 // Default 90-day retention for compliance
	}

	cutoff := time.Now().AddDate(0, 0, -policy.RetentionDays)

	if policy.DryRun {
		var count int64
		err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM audit_logs WHERE timestamp < $1", cutoff).Scan(&count)
		log.Printf("[Retention] DRY-RUN: Would purge %d audit logs older than %s (cutoff: %s)", count, cutoff.Format(time.RFC3339), cutoff)
		return count, err
	}

	res, err := db.ExecContext(ctx, "DELETE FROM audit_logs WHERE timestamp < $1", cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to purge audit logs: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to retrieve deleted audit log count: %w", err)
	}

	log.Printf("[Retention] Successfully purged %d audit logs older than %s", rowsAffected, cutoff.Format(time.RFC3339))
	return rowsAffected, nil
}
