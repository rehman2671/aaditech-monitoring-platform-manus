# SentinelPulse Local Windows Deployment Guide

## Overview
This runbook guides you through deploying **SentinelPulse** on your local Windows system using Docker Desktop (or native binaries) for the Go backend, TimescaleDB, Redis, and the React dashboard, followed by installing the native .NET 8 Windows EDR agent via PowerShell or the WiX MSI installer [1].

---

## Prerequisites
1. **Docker Desktop for Windows** (with WSL 2 backend enabled).
2. **.NET 8 SDK & Runtime** (for building or running the C# Windows agent) [2].
3. **PowerShell 7+** (recommended) or Windows PowerShell 5.1.

---

## Step 1: Start Infrastructure & Backend via Docker Compose
Open PowerShell in the repository root and start the production stack:
```powershell
cd deployment
docker compose -f docker-compose.yml up -d
```
This starts:
- **TimescaleDB (`sentinelpulse_db`)** on port `5432` with automated hypertable migrations.
- **Redis (`sentinelpulse_redis`)** on port `6379` for telemetry streaming.
- **SentinelPulse Go Backend (`sentinelpulse_backend`)** on port `8080`.

Verify container health:
```powershell
docker ps
```

---

## Step 2: Access the React Management Dashboard
Open your browser and navigate to:
- **Dashboard URL**: `http://localhost:8080` (or via the WebDev preview URL if running integrated Vite).
- Log in using your admin credentials to manage endpoints, review alerts, and view WMI diagnostics.

---

## Step 3: Install the Native Windows EDR Agent
To enroll your local Windows machine as an active telemetry endpoint:

1. Generate an enrollment token in the SentinelPulse Admin Console (`/tokens`).
2. Run PowerShell as **Administrator** and execute the deployment script:
```powershell
$token = "sp_enrol_YOUR_TOKEN_HERE"
$apiUrl = "http://localhost:8080"
Invoke-WebRequest -Uri "$apiUrl/api/v1/agents/install.ps1" -OutFile "$env:TEMP\install.ps1"
& "$env:TEMP\install.ps1" -Token $token -ApiUrl $apiUrl
```

Alternatively, build and install the MSI package locally using WiX v4:
```powershell
cd agent/packaging
wix extension add WixToolset.NetFx.wixext
wix build sentinelpulse-agent.wxs -ext WixToolset.NetFx.wixext -out SentinelPulse-Agent-Local.msi
msiexec /i SentinelPulse-Agent-Local.msi /quiet /norestart
```

---

## Step 4: Verify Telemetry & EDR Commands
1. Check that the Windows Service `SentinelPulseAgent` is running:
   ```powershell
   Get-Service SentinelPulseAgent
   ```
2. Inspect real-time hardware, CPU, RAM, and WMI collectors in the SentinelPulse Fleet Dashboard.
3. Issue an endpoint command (e.g., `QUARANTINE` or `ISOLATE`) from the UI and verify execution in agent logs (`C:\ProgramData\SentinelPulse\logs\`).

---

## References
[1] Docker Compose Production Reference: `docs/DEPLOYMENT.md`  
[2] .NET 8 SDK Documentation: https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-8


## Toolchain troubleshooting references

The .NET/NuGet restore process requires valid Windows profile and system path variables, particularly `LOCALAPPDATA` and the Program Files locations. NuGet documents this failure mode in [NuGet/Home issue 11863](https://github.com/NuGet/Home/issues/11863), where an invalid `LocalApplicationData` path produces the opaque `path1` error.

WiX v4 is installed as the `wix` .NET tool and uses `wix build` rather than the WiX v3 `candle.exe`/`light.exe` pair. The official usage documentation is available in the [FireGiant WiX Using WiX guide](https://docs.firegiant.com/wix/using-wix/).
