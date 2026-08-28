package intelligence

import (
	"testing"
	"time"
)

func TestAggregateApplicationsGroupsKnownExecutableByApplication(t *testing.T) {
	cpuA, cpuB := 20.0, 10.0
	ramA, ramB := uint64(100), uint64(300)
	captured := time.Unix(100, 0).UTC()
	groups := AggregateApplications([]ProcessSample{
		{EndpointID: "endpoint-1", CapturedAt: captured, PID: 10, Name: "chrome.exe", CPUPercent: &cpuA, WorkingSetBytes: &ramA, Availability: EvidenceObserved},
		{EndpointID: "endpoint-1", CapturedAt: captured.Add(time.Minute), PID: 11, Name: "chrome.exe", CPUPercent: &cpuB, WorkingSetBytes: &ramB, Availability: EvidenceObserved},
	})
	if len(groups) != 1 {
		t.Fatalf("expected one known application group, got %d", len(groups))
	}
	group := groups[0]
	if group.Application != "Google Chrome" || group.GroupingBasis != "known_executable" || group.Confidence != 0.95 {
		t.Fatalf("unexpected known grouping: %+v", group)
	}
	if group.ProcessCount != 2 || group.TotalCPU == nil || *group.TotalCPU != 30 {
		t.Fatalf("unexpected aggregate metrics: %+v", group)
	}
	if group.TotalRAMBytes == nil || *group.TotalRAMBytes != 400 || group.PeakRAMBytes == nil || *group.PeakRAMBytes != 300 {
		t.Fatalf("unexpected RAM metrics: %+v", group)
	}
}

func TestAggregateApplicationsGroupsExactPathsButKeepsUnknownPidsSeparate(t *testing.T) {
	path := `C:\Tools\worker.exe`
	groups := AggregateApplications([]ProcessSample{
		{EndpointID: "endpoint-1", CapturedAt: time.Unix(100, 0), PID: 20, Name: "worker.exe", ExecutablePath: &path, Availability: EvidenceObserved},
		{EndpointID: "endpoint-1", CapturedAt: time.Unix(101, 0), PID: 21, Name: "worker.exe", ExecutablePath: &path, Availability: EvidenceObserved},
		{EndpointID: "endpoint-1", CapturedAt: time.Unix(102, 0), PID: 22, Name: "unknown.exe", Availability: EvidenceObserved},
		{EndpointID: "endpoint-1", CapturedAt: time.Unix(103, 0), PID: 23, Name: "unknown.exe", Availability: EvidenceObserved},
	})
	if len(groups) != 3 {
		t.Fatalf("expected exact path group plus two unresolved processes, got %d", len(groups))
	}
	for _, group := range groups {
		if group.Application == "unknown.exe" && group.ProcessCount != 1 {
			t.Fatalf("unknown processes were merged: %+v", group)
		}
		if group.GroupingBasis == "unresolved_process_pid" && group.Confidence != 0.10 {
			t.Fatalf("unresolved process confidence was not explicit: %+v", group)
		}
	}
}
