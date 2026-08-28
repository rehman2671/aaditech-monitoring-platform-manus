package intelligence

import (
	"path/filepath"
	"sort"
	"strings"
)

type applicationGroup struct {
	key        string
	name       string
	basis      string
	confidence float64
	samples    []ProcessSample
}

// AggregateApplications groups only evidence with a reliable identity. Known
// executable mappings and exact executable paths may be grouped. Unknown
// processes remain separate by PID so an ambiguous name cannot merge unrelated
// processes.
func AggregateApplications(samples []ProcessSample) []ApplicationAggregate {
	groups := make(map[string]*applicationGroup)
	for _, sample := range samples {
		key, name, basis, confidence := groupingIdentity(sample)
		group := groups[key]
		if group == nil {
			group = &applicationGroup{key: key, name: name, basis: basis, confidence: confidence}
			groups[key] = group
		}
		group.samples = append(group.samples, sample)
	}

	result := make([]ApplicationAggregate, 0, len(groups))
	for _, group := range groups {
		if len(group.samples) == 0 {
			continue
		}
		start, end := group.samples[0].CapturedAt, group.samples[0].CapturedAt
		var totalCPU, peakCPU float64
		var cpuCount int
		var totalRAM, peakRAM uint64
		var ramCount int
		for _, sample := range group.samples {
			if sample.CapturedAt.Before(start) {
				start = sample.CapturedAt
			}
			if sample.CapturedAt.After(end) {
				end = sample.CapturedAt
			}
			if sample.CPUPercent != nil {
				totalCPU += *sample.CPUPercent
				if *sample.CPUPercent > peakCPU {
					peakCPU = *sample.CPUPercent
				}
				cpuCount++
			}
			if sample.WorkingSetBytes != nil {
				totalRAM += *sample.WorkingSetBytes
				if *sample.WorkingSetBytes > peakRAM {
					peakRAM = *sample.WorkingSetBytes
				}
				ramCount++
			}
		}
		aggregate := ApplicationAggregate{
			EndpointID:    group.samples[0].EndpointID,
			WindowStart:   start,
			WindowEnd:     end,
			Application:   group.name,
			GroupingBasis: group.basis,
			Confidence:    group.confidence,
			ProcessCount:  len(group.samples),
			Availability:  EvidenceObserved,
		}
		if cpuCount > 0 {
			aggregate.TotalCPU = float64Ptr(totalCPU)
			aggregate.AverageCPU = float64Ptr(totalCPU / float64(cpuCount))
			aggregate.PeakCPU = float64Ptr(peakCPU)
		}
		if ramCount > 0 {
			aggregate.TotalRAMBytes = uint64Ptr(totalRAM)
			aggregate.AverageRAMBytes = uint64Ptr(totalRAM / uint64(ramCount))
			aggregate.PeakRAMBytes = uint64Ptr(peakRAM)
		}
		result = append(result, aggregate)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Application == result[j].Application {
			return result[i].WindowStart.Before(result[j].WindowStart)
		}
		return result[i].Application < result[j].Application
	})
	return result
}

var knownApplications = map[string]string{
	"chrome.exe":         "Google Chrome",
	"msedge.exe":         "Microsoft Edge",
	"firefox.exe":        "Mozilla Firefox",
	"docker desktop.exe": "Docker Desktop",
	"docker.exe":         "Docker Desktop",
	"vmmemwsl.exe":       "WSL",
	"code.exe":           "Visual Studio Code",
	"devenv.exe":         "Visual Studio",
}

func groupingIdentity(sample ProcessSample) (key, name, basis string, confidence float64) {
	path := strings.TrimSpace(sample.ExecutablePathValue())
	base := strings.ToLower(filepath.Base(strings.ReplaceAll(path, "\\", "/")))
	if base == "." || base == "" {
		base = strings.ToLower(strings.TrimSpace(sample.Name))
	}
	if known, ok := knownApplications[base]; ok {
		return "known:" + base, known, "known_executable", 0.95
	}
	if path != "" {
		return "path:" + strings.ToLower(path), processName(base, sample.Name), "exact_executable_path", 0.90
	}
	return "pid:" + itoa(sample.PID), sample.Name, "unresolved_process_pid", 0.10
}

// ExecutablePathValue isolates the nullable contract field without exposing a
// second public process model to callers.
func (p ProcessSample) ExecutablePathValue() string {
	if p.ExecutablePath == nil {
		return ""
	}
	return *p.ExecutablePath
}

func processName(base, fallback string) string {
	if base == "" {
		return fallback
	}
	return strings.TrimSuffix(base, filepath.Ext(base))
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	buf := make([]byte, 0, 12)
	for value > 0 {
		buf = append([]byte{byte('0' + value%10)}, buf...)
		value /= 10
	}
	if negative {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

func float64Ptr(value float64) *float64 { return &value }
func uint64Ptr(value uint64) *uint64    { return &value }
