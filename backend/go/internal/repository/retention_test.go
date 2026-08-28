package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRetentionPolicy_Compilation(t *testing.T) {
	policy := RetentionPolicy{RetentionDays: 90, DryRun: true}
	if policy.RetentionDays != 90 {
		t.Errorf("expected 90 retention days")
	}
}

func TestPurgeOldAuditLogsIsTenantScoped(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectExec(`DELETE FROM audit_logs WHERE tenant_id = \$1 AND created_at < \$2`).
		WithArgs("tenant-1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 3))
	count, err := PurgeOldAuditLogs(context.Background(), db, "tenant-1", RetentionPolicy{RetentionDays: 90})
	if err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("expected three deleted audit rows, got %d", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestPurgeOldProcessSamplesDryRunIsTenantScoped(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM endpoint_process_samples`).
		WithArgs("tenant-1", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))
	count, err := PurgeOldProcessSamples(context.Background(), db, "tenant-1", RetentionPolicy{RetentionDays: 30, DryRun: true})
	if err != nil {
		t.Fatal(err)
	}
	if count != 5 {
		t.Fatalf("expected five process rows in dry run, got %d", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestPurgeOldProcessSamplesRejectsMissingTenant(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := PurgeOldProcessSamples(context.Background(), db, "", RetentionPolicy{}); err == nil {
		t.Fatal("expected missing tenant to be rejected")
	}
}
