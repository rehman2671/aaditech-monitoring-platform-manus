package intelligence

import "time"

type EvidenceAvailability string

const (
	EvidenceObserved     EvidenceAvailability = "OBSERVED"
	EvidenceUnavailable  EvidenceAvailability = "UNAVAILABLE"
	EvidenceUnknown      EvidenceAvailability = "UNKNOWN"
	EvidenceInsufficient EvidenceAvailability = "INSUFFICIENT_EVIDENCE"
)

type FindingSeverity string

const (
	SeverityCritical      FindingSeverity = "CRITICAL"
	SeverityHigh          FindingSeverity = "HIGH"
	SeverityMedium        FindingSeverity = "MEDIUM"
	SeverityLow           FindingSeverity = "LOW"
	SeverityInformational FindingSeverity = "INFORMATIONAL"
	SeverityUnknown       FindingSeverity = "UNKNOWN"
)

type FindingStatus string

const (
	FindingOpen         FindingStatus = "OPEN"
	FindingAcknowledged FindingStatus = "ACKNOWLEDGED"
	FindingDismissed    FindingStatus = "DISMISSED"
	FindingResolved     FindingStatus = "RESOLVED"
	FindingUnknown      FindingStatus = "UNKNOWN"
)

type EvidenceRef struct {
	ID           string               `json:"id"`
	Source       string               `json:"source"`
	Field        string               `json:"field"`
	CapturedAt   time.Time            `json:"captured_at"`
	Availability EvidenceAvailability `json:"availability"`
	Value        any                  `json:"value,omitempty"`
	Reason       string               `json:"reason,omitempty"`
}

type ProcessSample struct {
	TenantID        string               `json:"-"`
	EndpointID      string               `json:"endpoint_id"`
	CapturedAt      time.Time            `json:"captured_at"`
	PID             int                  `json:"pid"`
	Name            string               `json:"name"`
	ExecutablePath  *string              `json:"executable_path,omitempty"`
	CommandLine     *string              `json:"command_line,omitempty"`
	Publisher       *string              `json:"publisher,omitempty"`
	Signature       *string              `json:"signature,omitempty"`
	ExecutableHash  *string              `json:"executable_hash,omitempty"`
	ParentPID       *int                 `json:"parent_pid,omitempty"`
	ParentName      *string              `json:"parent_name,omitempty"`
	StartTime       *time.Time           `json:"start_time,omitempty"`
	UserSession     *string              `json:"user_session,omitempty"`
	CPUPercent      *float64             `json:"cpu_percent,omitempty"`
	CPUTimeSeconds  *float64             `json:"cpu_time_seconds,omitempty"`
	WorkingSetBytes *uint64              `json:"working_set_bytes,omitempty"`
	PrivateBytes    *uint64              `json:"private_bytes,omitempty"`
	VirtualBytes    *uint64              `json:"virtual_bytes,omitempty"`
	ThreadCount     *int                 `json:"thread_count,omitempty"`
	HandleCount     *int                 `json:"handle_count,omitempty"`
	Priority        *int                 `json:"priority,omitempty"`
	IntegrityLevel  *string              `json:"integrity_level,omitempty"`
	State           string               `json:"state"`
	Availability    EvidenceAvailability `json:"availability"`
}

type ApplicationAggregate struct {
	TenantID        string               `json:"-"`
	EndpointID      string               `json:"endpoint_id"`
	WindowStart     time.Time            `json:"window_start"`
	WindowEnd       time.Time            `json:"window_end"`
	Application     string               `json:"application"`
	GroupingBasis   string               `json:"grouping_basis"`
	Confidence      float64              `json:"confidence"`
	ProcessCount    int                  `json:"process_count"`
	TotalCPU        *float64             `json:"total_cpu,omitempty"`
	AverageCPU      *float64             `json:"average_cpu,omitempty"`
	PeakCPU         *float64             `json:"peak_cpu,omitempty"`
	TotalRAMBytes   *uint64              `json:"total_ram_bytes,omitempty"`
	AverageRAMBytes *uint64              `json:"average_ram_bytes,omitempty"`
	PeakRAMBytes    *uint64              `json:"peak_ram_bytes,omitempty"`
	Availability    EvidenceAvailability `json:"availability"`
}

type Finding struct {
	TenantID             string          `json:"-"`
	FindingID            string          `json:"finding_id"`
	EndpointID           string          `json:"endpoint_id"`
	Timestamp            time.Time       `json:"timestamp"`
	Category             string          `json:"category"`
	Severity             FindingSeverity `json:"severity"`
	Confidence           float64         `json:"confidence"`
	Title                string          `json:"title"`
	Description          string          `json:"description"`
	Evidence             []EvidenceRef   `json:"evidence"`
	Source               string          `json:"source"`
	FirstSeen            time.Time       `json:"first_seen"`
	LastSeen             time.Time       `json:"last_seen"`
	OccurrenceCount      int             `json:"occurrence_count"`
	Status               FindingStatus   `json:"status"`
	RecommendedAction    string          `json:"recommended_action,omitempty"`
	RemediationAvailable bool            `json:"remediation_available"`
	RequiresConfirmation bool            `json:"requires_confirmation"`
}

type HealthScore struct {
	Overall       *int                 `json:"overall,omitempty"`
	SystemHealth  *int                 `json:"system_health,omitempty"`
	Security      *int                 `json:"security,omitempty"`
	Performance   *int                 `json:"performance,omitempty"`
	Storage       *int                 `json:"storage,omitempty"`
	Drivers       *int                 `json:"drivers,omitempty"`
	OSHealth      *int                 `json:"os_health,omitempty"`
	DataQuality   *int                 `json:"data_quality,omitempty"`
	WeightVersion string               `json:"weight_version"`
	Explanation   string               `json:"explanation"`
	Availability  EvidenceAvailability `json:"availability"`
}

type AnalystAssessment struct {
	TenantID          string          `json:"-"`
	EndpointID        string          `json:"endpoint_id"`
	EvidenceHash      string          `json:"evidence_hash"`
	Provider          string          `json:"provider"`
	Model             string          `json:"model"`
	GeneratedAt       time.Time       `json:"generated_at"`
	OverallRisk       FindingSeverity `json:"overall_risk"`
	Confidence        float64         `json:"confidence"`
	Summary           string          `json:"summary"`
	Findings          []Finding       `json:"findings"`
	PositiveFindings  []string        `json:"positive_findings"`
	DataQualityIssues []string        `json:"data_quality_issues"`
	RecommendedSteps  []string        `json:"recommended_steps"`
	Available         bool            `json:"available"`
	UnavailableReason string          `json:"unavailable_reason,omitempty"`
}

type EndpointReport struct {
	TenantID     string             `json:"-"`
	EndpointID   string             `json:"endpoint_id"`
	GeneratedAt  time.Time          `json:"generated_at"`
	AgentVersion string             `json:"agent_version,omitempty"`
	Evidence     []EvidenceRef      `json:"evidence"`
	Findings     []Finding          `json:"findings"`
	Health       HealthScore        `json:"health"`
	Assessment   *AnalystAssessment `json:"assessment,omitempty"`
	DataQuality  []string           `json:"data_quality"`
}
