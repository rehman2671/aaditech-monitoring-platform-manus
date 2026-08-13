package repository

import (
	"testing"
)

func TestRetentionPolicy_Compilation(t *testing.T) {
	policy := RetentionPolicy{RetentionDays: 90, DryRun: true}
	if policy.RetentionDays != 90 {
		t.Errorf("expected 90 retention days")
	}
}
