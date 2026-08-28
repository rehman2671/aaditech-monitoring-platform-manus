package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestQueryProcessHistoryAllowsOnlyKnownBuckets(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := QueryProcessHistory(context.Background(), db, "tenant-1", "endpoint-1", "10m", time.Time{}, time.Time{}); err == nil {
		t.Fatal("expected unsupported bucket to be rejected")
	}
}

func TestQueryProcessHistoryPreservesNullAggregatesAndTenantScope(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	from := time.Unix(0, 0).UTC()
	to := from.Add(time.Hour)
	mock.ExpectQuery(`SELECT date_bin\('5 minutes'::interval`).
		WithArgs("tenant-1", "endpoint-1", from, to).
		WillReturnRows(sqlmock.NewRows([]string{"bucket_start", "count", "avg", "max"}).
			AddRow(from, 2, nil, nil))
	buckets, err := QueryProcessHistory(context.Background(), db, "tenant-1", "endpoint-1", "5m", from, to)
	if err != nil {
		t.Fatal(err)
	}
	if len(buckets) != 1 || buckets[0].ProcessCount != 2 || buckets[0].AverageCPUPercent != nil || buckets[0].MaxWorkingSet != nil {
		t.Fatalf("expected truthful null aggregates, got %+v", buckets)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
