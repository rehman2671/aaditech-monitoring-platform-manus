# SentinelPulse Windows Agent

The native endpoint component is a .NET 8 Worker Service intended to run as a Windows Service with automatic start and restart. It collects identity, WMI/CIM hardware, disk and SMART health, Windows image health, reliability, drivers, installed software, performance counters, top processes, and Windows Event Log entries.

## Local Configuration

The service reads `C:\ProgramData\SentinelPulse\agent.json` so server re-pointing can be performed with Group Policy or configuration management without recompiling the agent.

```json
{
  "serverUrl": "https://monitoring.example.com",
  "endpointId": "uuid-after-enrollment",
  "agentVersion": "2.4.1",
  "heartbeatSeconds": 60,
  "collectorIntervals": {
    "hardwareHours": 24,
    "diskHours": 6,
    "osHealthHours": 24,
    "performanceSeconds": 30,
    "processSeconds": 60,
    "eventBatchSeconds": 60
  },
  "buffer": {
    "sqlitePath": "C:\\ProgramData\\SentinelPulse\\agent_buffer.db",
    "maxDays": 7
  }
}
```

The endpoint API key is not stored in plaintext JSON. It is protected with Windows DPAPI under the LocalSystem service identity. The enrollment token is accepted once and expires after 24 hours.

## Required Windows Permissions

The service should run as `LocalSystem` only for the namespaces it requires. Basic identity, CPU, RAM, process, and event-log collection does not require the interactive user to be an administrator. SMART and some device-driver fields can be unavailable when the machine policy blocks access; the collector must return an explicit `unavailable` flag and reason instead of dropping the field.

Required access includes read access to `root\CIMV2`, `root\WMI` for storage health where supported, read access to the `System` and `Application` event logs, and permission to execute read-only `DISM /Online /Cleanup-Image /CheckHealth` and `sfc /verifyonly` checks during the scheduled diagnostic window. The agent never runs automatic repair.

## Offline Buffering and Reliability

Every failed push is written to the local SQLite buffer and retried with exponential backoff. The queue is capped at seven days. If older data is dropped, a `data_gap` marker is sent after connectivity resumes. Collector errors are written to a rolling local log capped at 50 MB and summarized in the heartbeat `agent_health` payload.

## Native Build Notes

The browser project cannot compile or run Windows-specific WMI, Event Log, DPAPI, SQLite, or MSI code in the Linux preview runtime. The scaffold under `agent/src/` defines the service entry point and collector/communication boundaries. A Windows build pipeline should add the `System.Management`, `Microsoft.Extensions.Hosting.WindowsServices`, SQLite queue, and WiX/MSI packaging projects before installing on a real endpoint.
