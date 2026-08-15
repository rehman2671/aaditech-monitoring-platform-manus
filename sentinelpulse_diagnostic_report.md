# SentinelPulse Windows Endpoint Diagnostic & Telemetry Resolution Report

## Executive Summary

An exhaustive read-only inspection and evidence correlation was conducted on the connected Windows laptop (`DESKTOP-1E02MC9`) where both the SentinelPulse Docker backend (`sentinelpulse_backend`, `sentinelpulse_db`, `sentinelpulse_redis`) and the local Windows Agent (`SentinelPulseAgent` service running executable version `2.4.4`) are co-hosted. 

The investigation conclusively established why telemetry was not reaching the portal: **the Windows agent service is attempting to run with an unhashed enrollment token or missing a valid database enrollment token record, resulting in recurring enrollment rejection.** Specifically, while the machine environment variable `SENTINELPULSE_ENROLLMENT_TOKEN` is populated with a 64-character hex string (`bfac58fa...`), the backend expects a standard canonical enrollment token matching `sp-enrol-<UUID>` (which is then hashed via SHA-256 before database comparison). Furthermore, no active or unconsumed token matching that value exists in the backend's `enrollment_tokens` table, and no `endpoint_credentials` or `endpoints` records have been provisioned for `DESKTOP-1E02MC9`.

---

## Evidence & Diagnostic Findings

### 1. Endpoint Service & Configuration State
- **Service Status:** `SentinelPulseAgent` is installed at `C:\Program Files\SentinelPulse\Agent\SentinelPulse.Agent.exe`, configured with `StartType: Automatic`, and currently reporting `State: Running`.
- **Registry Configuration (`HKLM:\SOFTWARE\SentinelPulse\Agent`):**
  - `BootstrapApiBaseUrl`: `http://127.0.0.1:8080` (Correctly pointing to local Docker backend)
  - `BootstrapEndpointId`: `DESKTOP-1E02MC9`
  - `Version`: `2.4.4`
- **Machine Environment Variables:**
  - `SENTINELPULSE_API_BASE_URL`: `http://127.0.0.1:8080`
  - `SENTINELPULSE_ENDPOINT_ID`: `DESKTOP-1E02MC9`
  - `SENTINELPULSE_ENROLLMENT_TOKEN`: Present (Length 64, raw prefix `bfac58fa...`)
  - `SENTINELPULSE_DEVICE_TOKEN`: `<missing>` (Proves enrollment has never successfully completed)

### 2. Windows Event Log Observations
The Windows Application event log repeatedly records the following error from `SentinelPulse.Agent`:
```
Category: SentinelPulse.Agent.Worker
EventId: 0
Level: Error
Message: Agent is not enrolled. Configure SENTINELPULSE_ENROLLMENT_TOKEN once, or provision an encrypted device credential.
```

### 3. Backend & Database Correlation
- **Database Tables (`sentinelpulse` on `sentinelpulse_db`):**
  - `enrollment_tokens`: Contains expired or mismatched tokens. No unconsumed token exists that hashes to the token configured on the endpoint.
  - `endpoint_credentials`: `0 rows`.
  - `endpoints`: `0 rows`.
  - `endpoint_metrics_hyper`: `0 rows` (No telemetry has ever been ingested).
- **API Health:**
  - `GET http://127.0.0.1:8080/health/ready` returns `HTTP 200 {"status":"ready"}`.
  - `GET http://127.0.0.1:8080/api/v1/auth/setup-status` returns `HTTP 200 {"setup_complete":true}`.
  - `POST http://127.0.0.1:8080/api/v1/agent/enroll` correctly rejects malformed or unauthorized tokens with `HTTP 401 Unauthorized`.

---

## Root Cause Analysis

1. **Token Mismatch / Format Error:** The enrollment token currently stored in the Windows machine environment is a 64-character hex string (resembling an MSI builder key or direct hash) rather than the canonical bearer format `sp-enrol-<UUID>` required by `ApiClient.cs` and validated by `EnrollmentHandler`.
2. **Missing Backend Token Record:** Even if the token format were valid, the backend database has no active `enrollment_tokens` entry corresponding to this token hash because it was never generated via the portal or inserted into TimescaleDB for the active tenant organization.
3. **Execution Loop Consequence:** Because enrollment fails immediately upon service startup, the agent cannot acquire or decrypt an `sp-agent-<UUID>` device token, falling back to logging `Agent is not enrolled` every 30 seconds without enqueuing or transmitting WMI telemetry.

---

## Corrective Action Plan

To resolve this issue end-to-end on your local machine without disturbing existing containers or data:

1. **Generate a Fresh Tenant-Scoped Token:**
   Log into the SentinelPulse portal (`http://localhost:3001`), navigate to **Enrollment Tokens**, and click **Generate Token**. This creates a canonical token beginning with `sp-enrol-` tied to your organization and persists its SHA-256 hash in TimescaleDB.

2. **Configure the Local Agent via Elevated PowerShell:**
   Run the official configuration helper on your Windows host:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Admin\Documents\Aaditech_Monitoring_Platform\agent\packaging\configure-agent-enrollment.ps1" -ApiBaseUrl "http://127.0.0.1:8080" -EndpointId "DESKTOP-1E02MC9"
   ```
   When prompted, paste your freshly generated `sp-enrol-...` token.

3. **Verify Service Enrollment & Telemetry:**
   - Check that the `SENTINELPULSE_DEVICE_TOKEN` environment variable is successfully populated and encrypted credentials are written.
   - Verify that `SentinelPulseAgent` restarts and successfully exchanges the token for a device credential.
   - Refresh the SentinelPulse dashboard to verify that `DESKTOP-1E02MC9` appears online with real CPU, RAM, disk, and WMI metrics.

---
*Report compiled by SentinelPulse Autonomous Diagnostics Engine.*
