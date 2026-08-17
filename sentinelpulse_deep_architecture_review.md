# SentinelPulse: Out-of-the-Box Architecture Review & Deep Research

**Author:** Manus AI  
**Date:** August 2026  
**Subject:** Comprehensive Architectural Audit of SentinelPulse (Windows Endpoint Monitoring & Diagnostics Platform)

---

## 1. Executive Summary: Why Have We Struggled for 5 Days?

Over the past several days, SentinelPulse has encountered recurring friction:
1. **MSI builder queuing and polling desynchronization.**
2. **Strict code-signing dependencies failing clean developer environments.**
3. **Configuration propagation gaps** (where installer properties, WiX properties, Registry keys, and JSON files drifted).
4. **Authentication and tenant-context mismatches** between the React frontend, Express/tRPC portal backend, Go telemetry/control backend, and Windows runner.

When an engineering task stretches across multiple days with recurring cascading errors, it is rarely due to a simple syntax bug. It is almost always a **foundational architectural mismatch** between *how the system was designed* and *how real-world systems operate*. 

This document steps back, analyzes our current pipeline, identifies architectural flaws, researches industry-standard endpoint management patterns, and proposes a robust, zero-manual target architecture.

---

## 2. Inventory of Current Architecture & Core Friction Points

### 2.1 The Current 3-Tier Distributed Pipeline
```
[React Portal (3001)] 
       │ (REST / tRPC)
       ▼
[Go Backend & TimescaleDB (8080)] ──(Polling Queue)──► [Windows Host Runner (PowerShell)]
                                                              │
                                                        (dotnet publish & WiX)
                                                              │
                                                              ▼
                                                        [Compiled MSI & Sign]
```

### 2.2 Why This Pipeline Breaks in Practice
1. **The Distributed Build-Host Antipattern:**  
   Building Windows MSI installers requires a native Windows machine with .NET SDKs, MSBuild, WiX v4 tooling, and signtool installed. Attempting to orchestrate this asynchronously via a Docker container backend queueing jobs for an external PowerShell runner creates a fragile **decoupled control plane**. If the PowerShell runner loses heartbeats, hits a PowerShell 5.1 compatibility bug (e.g., `[RandomNumberGenerator]::Fill`), or encounters signing exit code 1, the entire user-facing portal stalls.
2. **Over-Engineering Pre-Compiled Artifact Delivery:**  
   Instead of static pre-compiled agent binaries bundled into a universal MSI template, the system attempts *just-in-time compilation and signing* on the user's local machine via an automated runner. While elegant in theory, this couples cloud web application patterns with heavy native desktop build pipelines.
3. **Configuration Propagation Fragmentation:**  
   Bootstrap parameters (`ApiBaseUrl`, `EndpointId`, `EnrollmentToken`, `OrganizationId`) were required to pass through 5 distinct boundaries:
   - Portal form inputs →
   - Go backend database job queue (`msi_build_jobs`) →
   - Runner JSON poll payload →
   - WiX WiXVariables/Environment properties →
   - Windows Registry (`HKLM\Software\SentinelPulse\Agent`) vs. local `config.json`.
   Any slight mismatch in one boundary caused agent enrollment to fail with `401 Unauthorized` or missing telemetry.

---

## 3. Industry Best Practices: How Enterprise MDMs & EDRs Operate

Researching enterprise endpoint management platforms (such as Fleet/osquery, Microsoft Intune, and Elastic Agent) reveals three golden rules of agent packaging and enrollment:

1. **Decouple Installer Generation from Identity:**  
   The `.msi` or `.pkg` installer should be a **universal, signed, generic package** that contains the agent binaries, Windows Service wrapper, and default bootstrap logic. It should *not* embed a hardcoded one-time tenant enrollment token inside the installer package binary itself.
2. **The "Two-Phase" Enrollment Model:**  
   - **Phase 1 (Installation):** The MSI installs the Windows Service and registers it with the OS.
   - **Phase 2 (Bootstrap & Device Onboarding):** Upon starting, the agent reads a local config file or prompts/requests an enrollment token, or uses an automated deployment token passed via MSI public properties (`MSIINSTALLPARAMETERS` or `SETUP_TOKEN`). It talks to the backend API (`/api/v1/enroll`), authenticates the bootstrap token, receives a permanent cryptographically secured device certificate/token, and stores it securely via Windows DPAPI.
3. **Centralized Dynamic Configuration:**  
   Once enrolled, agents fetch their configuration updates and heartbeat intervals dynamically from the backend over TLS. Hardcoding server IPs inside installer binaries violates infrastructure flexibility.

---

## 4. Root Cause Analysis: The Core Architectural Flaws

| Architectural Area | Current Flaw | Industry Standard |
| :--- | :--- | :--- |
| **Installer Compilation** | Asynchronous cloud queue trying to trigger a local PowerShell build runner. | Pre-built universal installer templates with dynamic property injection. |
| **Token Handling** | Embedding raw enrollment tokens into MSI build payloads. | Device onboarding via secure enrollment endpoint + DPAPI device credentials. |
| **Configuration Binding** | Splitting config between Registry keys and local JSON files without clear precedence. | Single unified `config.json` in `ProgramData` with environment variable overrides. |
| **Signing Dependency** | Failing builds entirely when trusted certs are missing. | Graceful fallback to self-signed test certs with clear UI warnings. |

---

## 5. The Corrected Target Architecture: "Universal MSI + Dynamic Enrollment"

To make SentinelPulse 100% reliable, zero-manual, and robust, we must simplify the workflow:

```
[ Universal Pre-Built MSI Template ]
         │ (Installs Windows Service & ProgramData\SentinelPulse\config.json)
         ▼
[ Windows Endpoint Service starts ]
         │ (Reads config.json: ApiBaseUrl & EnrollmentToken)
         ▼
[ Mutual TLS / Authenticated POST /api/v1/enroll ]
         │ (Exchanges Token for Device ID & Secret Key)
         ▼
[ Secure Local Storage (DPAPI) ]
         │ (Saves Device Credential for subsequent WMI Telemetry push)
         ▼
[ Real-Time Telemetry Stream ]
```

### Key Design Shifts:
1. **Eliminate the Asynchronous MSI Build Queue for Normal Operations:**  
   Instead of compiling `SentinelPulseAgent.exe` and running WiX on every portal click, provide a pre-compiled, signed universal installer template where the server base URL and enrollment token can be supplied either during installation (`msiexec /i SentinelPulseAgent.msi API_BASE_URL="http://..." ENROLLMENT_TOKEN="sp-enrol-..."`) or via a simple post-install setup utility.
2. **Unified Configuration Hierarchy:**  
   The agent reads configuration in strict fallback order:
   1. Environment Variables (`SENTINELPULSE_API_BASE_URL`)
   2. Local JSON File (`C:\ProgramData\SentinelPulse\config.json`)
   3. Windows Registry (`HKLM\Software\SentinelPulse\Agent`)
   This guarantees that changing the server IP or base URL only requires updating `config.json` and restarting the Windows Service—**zero MSI rebuild required**.

---

## 6. Actionable Implementation Roadmap (No-Manual-Work)

1. **Phase 1: Simplify Agent Configuration:** Refactor `AgentConfiguration.cs` to prioritize `ProgramData\SentinelPulse\config.json`, allowing instant server IP updates without recompilation.
2. **Phase 2: Universal MSI Packaging:** Update `sentinelpulse-agent.wxs` to accept public MSI properties (`API_BASE_URL`, `ENROLLMENT_TOKEN`) and write them directly into `config.json` during installation.
3. **Phase 3: Robust Enrollment Exchange:** Ensure the agent's first boot executes a clean bootstrap enrollment handshake against `/api/v1/enroll`, exchanging the token for a persistent device credential stored securely via DPAPI.
4. **Phase 4: End-to-End Validation:** Verify service startup, automated enrollment, WMI metric collection, and dashboard visibility.

---
*End of Deep Architecture Review.*
