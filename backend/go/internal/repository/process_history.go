package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type ProcessHistoryBucket struct {
	BucketStart       time.Time
	ProcessCount      int
	AverageCPUPercent *float64
	MaxWorkingSet     *int64
}

// QueryProcessHistory returns bounded aggregate buckets for an authenticated
// tenant/endpoint. The bucket interval is allow-listed to avoid SQL injection.
func QueryProcessHistory(ctx context.Context, db *sql.DB, tenantID, endpointID, bucket string, since, until time.Time) ([]ProcessHistoryBucket, error) {
	if strings.TrimSpace(tenantID) == "" || strings.TrimSpace(endpointID) == "" {
		return nil, fmt.Errorf("tenant ID and endpoint ID are required")
	}
	interval, err := processBucketInterval(bucket)
	if err != nil {
		return nil, err
	}
	if until.IsZero() {
		until = time.Now().UTC()
	}
	if since.IsZero() {
		since = until.Add(-24 * time.Hour)
	}
	if !since.Before(until) {
		return nil, fmt.Errorf("history start must be before history end")
	}
	rows, err := db.QueryContext(ctx, fmt.Sprintf(`
		SELECT date_bin('%s'::interval, captured_at, TIMESTAMPTZ '2000-01-01') AS bucket_start,
		       COUNT(*)::integer,
		       AVG(cpu_percent),
		       MAX(working_set_bytes)
		FROM endpoint_process_samples
		WHERE tenant_id = $1 AND endpoint_id = $2 AND captured_at >= $3 AND captured_at < $4
		GROUP BY bucket_start
		ORDER BY bucket_start ASC
	`, interval), tenantID, endpointID, since.UTC(), until.UTC())
	if err != nil {
		return nil, fmt.Errorf("query process history: %w", err)
	}
	defer rows.Close()
	result := make([]ProcessHistoryBucket, 0)
	for rows.Next() {
		var bucketStart time.Time
		var processCount int
		var averageCPU sql.NullFloat64
		var maxWorkingSet sql.NullInt64
		if err := rows.Scan(&bucketStart, &processCount, &averageCPU, &maxWorkingSet); err != nil {
			return nil, fmt.Errorf("scan process history: %w", err)
		}
		result = append(result, ProcessHistoryBucket{
			BucketStart: bucketStart.UTC(), ProcessCount: processCount,
			AverageCPUPercent: nullableFloat64(averageCPU), MaxWorkingSet: nullableInt64Value(maxWorkingSet),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate process history: %w", err)
	}
	return result, nil
}

func processBucketInterval(bucket string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(bucket)) {
	case "5m", "5min", "5-minute":
		return "5 minutes", nil
	case "15m", "15min", "15-minute":
		return "15 minutes", nil
	case "1h", "hourly":
		return "1 hour", nil
	case "1d", "daily":
		return "1 day", nil
	case "1w", "weekly":
		return "1 week", nil
	default:
		return "", fmt.Errorf("unsupported process history bucket %q", bucket)
	}
}

func nullableFloat64(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	return &value.Float64
}

func nullableInt64Value(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}
