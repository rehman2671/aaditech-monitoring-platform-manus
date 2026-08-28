package intelligence

import (
	"fmt"
	"strings"
	"time"
)

type MetricSnapshot struct {
	CapturedAt      time.Time
	CPUUtilization  *float64
	RAMUtilization  *float64
	DiskUtilization *float64
	TemperatureC    *float64
}

type DeterministicInput struct {
	TenantID       string
	EndpointID     string
	Metrics        MetricSnapshot
	ProcessSamples []ProcessSample
}

// AnalyzeDeterministic emits only observations supported by supplied evidence.
// Thresholds are intentionally single-observation labels; sustained/correlated
// findings require the caller to supply a time window or additional context.
func AnalyzeDeterministic(input DeterministicInput) []Finding {
	capturedAt := input.Metrics.CapturedAt.UTC()
	if capturedAt.IsZero() {
		capturedAt = time.Now().UTC()
	}
	findings := make([]Finding, 0, 4)
	if input.Metrics.CPUUtilization != nil && *input.Metrics.CPUUtilization >= 90 {
		findings = append(findings, metricFinding(input, capturedAt, "cpu", SeverityMedium, "High CPU observation", fmt.Sprintf("CPU utilization was %.2f%% in the supplied sample.", *input.Metrics.CPUUtilization), "metrics.latest", "cpu_utilization", *input.Metrics.CPUUtilization))
	}
	if input.Metrics.RAMUtilization != nil && *input.Metrics.RAMUtilization >= 90 {
		findings = append(findings, metricFinding(input, capturedAt, "ram", SeverityMedium, "High memory observation", fmt.Sprintf("RAM utilization was %.2f%% in the supplied sample.", *input.Metrics.RAMUtilization), "metrics.latest", "ram_utilization", *input.Metrics.RAMUtilization))
	}
	if input.Metrics.DiskUtilization != nil && *input.Metrics.DiskUtilization >= 90 {
		findings = append(findings, metricFinding(input, capturedAt, "disk", SeverityMedium, "High disk utilization observation", fmt.Sprintf("Disk utilization was %.2f%% in the supplied sample.", *input.Metrics.DiskUtilization), "metrics.latest", "disk_utilization", *input.Metrics.DiskUtilization))
	}
	if input.Metrics.CPUUtilization == nil || input.Metrics.RAMUtilization == nil || input.Metrics.DiskUtilization == nil {
		missing := make([]string, 0, 3)
		if input.Metrics.CPUUtilization == nil {
			missing = append(missing, "CPU")
		}
		if input.Metrics.RAMUtilization == nil {
			missing = append(missing, "RAM")
		}
		if input.Metrics.DiskUtilization == nil {
			missing = append(missing, "disk")
		}
		findings = append(findings, Finding{
			TenantID: input.TenantID, FindingID: "data-quality-metrics-" + input.EndpointID,
			EndpointID: input.EndpointID, Timestamp: capturedAt, Category: "data_quality",
			Severity: SeverityInformational, Confidence: 1, Title: "Performance evidence is incomplete",
			Description: "The supplied endpoint sample has no observed values for " + strings.Join(missing, ", ") + ". Missing values remain unavailable and are not treated as zero.",
			Evidence:    []EvidenceRef{{ID: "metrics.latest", Source: "endpoint_metrics_hyper", Field: "availability", CapturedAt: capturedAt, Availability: EvidenceUnavailable, Reason: "metric field was not observed"}},
			Source:      "deterministic", FirstSeen: capturedAt, LastSeen: capturedAt, OccurrenceCount: 1,
			Status: FindingOpen, RemediationAvailable: false, RequiresConfirmation: false,
		})
	}
	return findings
}

func metricFinding(input DeterministicInput, capturedAt time.Time, suffix string, severity FindingSeverity, title, description, evidenceID, field string, value float64) Finding {
	return Finding{
		TenantID: input.TenantID, FindingID: fmt.Sprintf("metric-%s-%s-%s", input.EndpointID, suffix, capturedAt.Format("20060102150405")),
		EndpointID: input.EndpointID, Timestamp: capturedAt, Category: "performance", Severity: severity, Confidence: 1,
		Title: title, Description: description,
		Evidence: []EvidenceRef{{ID: evidenceID, Source: "endpoint_metrics_hyper", Field: field, CapturedAt: capturedAt, Availability: EvidenceObserved, Value: value}},
		Source:   "deterministic", FirstSeen: capturedAt, LastSeen: capturedAt, OccurrenceCount: 1,
		Status: FindingOpen, RecommendedAction: "Review the next samples before taking action.", RemediationAvailable: false, RequiresConfirmation: false,
	}
}
