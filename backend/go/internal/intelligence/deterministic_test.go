package intelligence

import (
	"strings"
	"testing"
	"time"
)

func TestAnalyzeDeterministicEmitsEvidenceBackedMetricObservations(t *testing.T) {
	captured := time.Unix(100, 0).UTC()
	cpu, ram, disk := 92.5, 91.0, 95.0
	findings := AnalyzeDeterministic(DeterministicInput{
		TenantID: "tenant-1", EndpointID: "endpoint-1",
		Metrics: MetricSnapshot{CapturedAt: captured, CPUUtilization: &cpu, RAMUtilization: &ram, DiskUtilization: &disk},
	})
	if len(findings) != 3 {
		t.Fatalf("expected three metric observations, got %d", len(findings))
	}
	for _, finding := range findings {
		if finding.Source != "deterministic" || finding.Confidence != 1 || finding.Status != FindingOpen {
			t.Fatalf("unexpected deterministic finding: %+v", finding)
		}
		if finding.Category != "performance" || strings.Contains(strings.ToLower(finding.Title), "malware") {
			t.Fatalf("metric observation was overstated: %+v", finding)
		}
		if len(finding.Evidence) != 1 || finding.Evidence[0].Availability != EvidenceObserved {
			t.Fatalf("metric evidence provenance missing: %+v", finding)
		}
	}
}

func TestAnalyzeDeterministicKeepsMissingMetricsUnavailable(t *testing.T) {
	findings := AnalyzeDeterministic(DeterministicInput{TenantID: "tenant-1", EndpointID: "endpoint-1"})
	if len(findings) != 1 {
		t.Fatalf("expected one data-quality finding, got %d", len(findings))
	}
	finding := findings[0]
	if finding.Category != "data_quality" || finding.Severity != SeverityInformational || finding.Confidence != 1 {
		t.Fatalf("unexpected missing-evidence finding: %+v", finding)
	}
	if !strings.Contains(finding.Description, "no observed values") || !strings.Contains(finding.Description, "not treated as zero") {
		t.Fatalf("missing evidence was not explained truthfully: %s", finding.Description)
	}
	if len(finding.Evidence) != 1 || finding.Evidence[0].Availability != EvidenceUnavailable {
		t.Fatalf("unavailable provenance missing: %+v", finding.Evidence)
	}
}
