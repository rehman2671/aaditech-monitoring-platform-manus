package intelligence

import (
	"strings"
	"testing"
	"time"
)

func TestCorrelateResourcePressureIsConservativeAndEvidenceBacked(t *testing.T) {
	captured := time.Unix(100, 0).UTC()
	findings := []Finding{
		{TenantID: "tenant-1", EndpointID: "endpoint-1", Timestamp: captured, Category: "performance", Severity: SeverityMedium, Confidence: 1, Title: "High CPU observation", Evidence: []EvidenceRef{{ID: "cpu"}}},
		{TenantID: "tenant-1", EndpointID: "endpoint-1", Timestamp: captured.Add(30 * time.Second), Category: "performance", Severity: SeverityMedium, Confidence: 0.8, Title: "High memory observation", Evidence: []EvidenceRef{{ID: "ram"}}},
	}
	correlated := CorrelateResourcePressure(findings, time.Minute)
	if len(correlated) != 1 {
		t.Fatalf("expected one conservative correlation, got %d", len(correlated))
	}
	finding := correlated[0]
	if finding.Category != "correlation" || finding.Severity != SeverityMedium || finding.Confidence != 0.8 {
		t.Fatalf("unexpected correlation: %+v", finding)
	}
	if len(finding.Evidence) != 2 || strings.Contains(strings.ToLower(finding.Description), "malware") && !strings.Contains(strings.ToLower(finding.Description), "not a malware") {
		t.Fatalf("correlation provenance or limitation missing: %+v", finding)
	}
}

func TestCorrelateResourcePressureDoesNotMergeDistantObservations(t *testing.T) {
	captured := time.Unix(100, 0).UTC()
	findings := []Finding{
		{EndpointID: "endpoint-1", Timestamp: captured, Category: "performance", Severity: SeverityMedium, Confidence: 1, Title: "High CPU observation"},
		{EndpointID: "endpoint-1", Timestamp: captured.Add(10 * time.Minute), Category: "performance", Severity: SeverityMedium, Confidence: 1, Title: "High memory observation"},
	}
	if correlated := CorrelateResourcePressure(findings, time.Minute); len(correlated) != 0 {
		t.Fatalf("expected distant observations not to correlate: %+v", correlated)
	}
}
