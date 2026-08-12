# SentinelPulse Agent Enrollment & WMI Diagnostics Specification

## 1. Unauthenticated Telemetry Blocking (Enrollment Gate)
To prevent rogue devices or unauthorized ingestion packets from poisoning telemetry tables, the ingestion gateway enforces a strict **Enrollment Gate**:
1. **Initial State**: Newly installed agents possess only an organization enrollment token (hashed with SHA-256 in PostgreSQL).
2. **Handshake**: The agent sends an HTTPS POST to `/api/v1/agent/enroll` presenting its enrollment token and hardware fingerprint (`Win32_ComputerSystemProduct` UUID + BIOS serial).
3. **Token Consumption**: The backend verifies the token hash, marks the token as consumed (`used_by_endpoint_id`), links the endpoint record, and issues a long-lived agent device JWT.
4. **Ingestion Enforcement**: All subsequent telemetry packets sent to `/api/v1/telemetry/ingest` **must** include the valid agent device JWT in the `Authorization: Bearer <token>` header. Any unauthenticated or pending packet is rejected with HTTP 401 Unauthorized and dropped from the active queue.

## 2. Real WMI & CIM Collectors (.NET 8 Agent)
The .NET 8 agent implements WMI-based polling without hardcoded stubs:
- **CPU**: Polled via `Win32_Processor` (ClockSpeed, NumberOfCores, NumberOfLogicalProcessors) and performance counters (`% Processor Time`).
- **RAM**: Polled via `Win32_OperatingSystem` (TotalVisibleMemorySize, FreePhysicalMemory).
- **Disk & S.M.A.R.T.**: Polled via `Win32_LogicalDisk` (FreeSpace, Size) and `MSStorageDriver_FailurePredictStatus` for S.M.A.R.T. health warnings.
- **Battery**: Polled via `Win32_Battery` (EstimatedChargeRemaining, BatteryStatus).
- **Network Adapters**: Polled via `Win32_NetworkAdapterConfiguration` (IPAddress, MACAddress, DefaultIPGateway).
