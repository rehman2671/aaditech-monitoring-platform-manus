package intelligence

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestProcessSampleRedactsTenantIDAndPreservesUnavailableEvidence(t *testing.T) {
	sample := ProcessSample{
		TenantID:     "tenant-secret",
		EndpointID:   "endpoint-1",
		CapturedAt:   time.Unix(100, 0).UTC(),
		PID:          42,
		Name:         "unknown.exe",
		State:        "running",
		Availability: EvidenceUnavailable,
	}
	encoded, err := json.Marshal(sample)
	if err != nil {
		t.Fatal(err)
	}
	body := string(encoded)
	if strings.Contains(body, "tenant-secret") {
		t.Fatalf("tenant ID leaked into JSON: %s", body)
	}
	if !strings.Contains(body, `"availability":"UNAVAILABLE"`) {
		t.Fatalf("unavailable evidence was not preserved: %s", body)
	}
	if strings.Contains(body, "cpu_percent") {
		t.Fatalf("missing CPU evidence must not be serialized as a fabricated field: %s", body)
	}
}

func TestFindingCarriesEvidenceAndRequiresConfirmation(t *testing.T) {
	finding := Finding{
		FindingID:            "finding-1",
		EndpointID:           "endpoint-1",
		Timestamp:            time.Unix(100, 0).UTC(),
		Category:             "performance",
		Severity:             SeverityUnknown,
		Confidence:           0.25,
		Title:                "Sustained CPU observation",
		Description:          "Additional observation is recommended.",
		Evidence:             []EvidenceRef{{ID: "metric-1", Source: "endpoint_metrics", Field: "cpu_utilization", Availability: EvidenceObserved}},
		Source:               "deterministic",
		FirstSeen:            time.Unix(100, 0).UTC(),
		LastSeen:             time.Unix(100, 0).UTC(),
		OccurrenceCount:      1,
		Status:               FindingOpen,
		RemediationAvailable: true,
		RequiresConfirmation: true,
	}
	if finding.Severity != SeverityUnknown || len(finding.Evidence) != 1 || !finding.RequiresConfirmation {
		t.Fatalf("finding safety contract was not preserved: %+v", finding)
	}
}
