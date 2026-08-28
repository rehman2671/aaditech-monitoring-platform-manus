package intelligence

import (
	"strings"
	"time"
)

// CorrelateResourcePressure combines only simultaneous deterministic resource
// observations for the same endpoint. It deliberately remains a performance
// finding and never turns resource pressure into a security verdict.
func CorrelateResourcePressure(findings []Finding, window time.Duration) []Finding {
	if window <= 0 {
		window = 5 * time.Minute
	}
	var cpuFinding, ramFinding *Finding
	for index := range findings {
		finding := &findings[index]
		if finding.Category != "performance" || finding.Severity == SeverityUnknown {
			continue
		}
		title := strings.ToLower(finding.Title)
		if strings.Contains(title, "cpu") {
			cpuFinding = finding
		}
		if strings.Contains(title, "memory") || strings.Contains(title, "ram") {
			ramFinding = finding
		}
	}
	if cpuFinding == nil || ramFinding == nil || cpuFinding.EndpointID != ramFinding.EndpointID {
		return []Finding{}
	}
	if cpuFinding.Timestamp.Sub(ramFinding.Timestamp) > window || ramFinding.Timestamp.Sub(cpuFinding.Timestamp) > window {
		return []Finding{}
	}
	capturedAt := cpuFinding.Timestamp
	if ramFinding.Timestamp.After(capturedAt) {
		capturedAt = ramFinding.Timestamp
	}
	confidence := cpuFinding.Confidence
	if ramFinding.Confidence < confidence {
		confidence = ramFinding.Confidence
	}
	evidence := append([]EvidenceRef{}, cpuFinding.Evidence...)
	evidence = append(evidence, ramFinding.Evidence...)
	return []Finding{{
		TenantID: cpuFinding.TenantID, FindingID: "correlation-resource-pressure-" + cpuFinding.EndpointID + "-" + capturedAt.Format("20060102150405"),
		EndpointID: cpuFinding.EndpointID, Timestamp: capturedAt, Category: "correlation", Severity: SeverityMedium, Confidence: confidence,
		Title: "Concurrent CPU and memory pressure", Description: "The supplied evidence contains high CPU and high RAM observations within the configured correlation window. This indicates resource pressure only; it is not a malware determination.",
		Evidence: evidence, Source: "deterministic", FirstSeen: capturedAt, LastSeen: capturedAt, OccurrenceCount: 1,
		Status: FindingOpen, RecommendedAction: "Review subsequent samples and active applications before taking action.", RemediationAvailable: false, RequiresConfirmation: false,
	}}
}
