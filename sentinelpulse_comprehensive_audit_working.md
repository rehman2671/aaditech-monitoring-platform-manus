# SentinelPulse Comprehensive Audit — Working Evidence

## Scope
This audit compares the stated SentinelPulse requirements with repository evidence, existing diagnostic reports, implementation files, and observed local Windows runtime behavior. Status labels are **Complete**, **Partial**, **Failed**, **Missing**, or **Unverified**; an item is not marked complete without direct evidence.

## Confirmed Evidence So Far

| Area | Status | Evidence and implication |
|---|---|---|
| MSI product version | Partial | Portal produced and downloaded `SentinelPulseAgent-2.4.5-x64.msi`; Programs & Features showed Product Version `2.4.5.0`. However the installed EXE metadata remained `1.0.0/1.0.0.0`, so package and binary release identity are inconsistent. |
| MSI signing | Failed for production/trusted mode; unsigned test succeeded | Self-signed build failed with SignTool `No certificates were found`; unsigned test MSI succeeded and was installed. No trusted code-signing certificate was reported by the runner. |
| Windows service installation | Verified for the tested host | `SentinelPulseAgent` was `Running`, `Automatic`; Task Manager showed SentinelPulse Windows Agent. |
| Runtime enrollment/config | Failed on tested install | Installed `C:\ProgramData\SentinelPulse\Agent\config.json` contained `endpoint_id=DESKTOP-1E02MC9`, `api_base_url=http://127.0.0.1:8080`, and no enrollment token. Thus remote/LAN telemetry cannot work and zero-manual enrollment was not achieved. |
| Agent configuration precedence | Partial and contrary to roadmap | `AgentConfiguration.cs` reads machine environment first, then PascalCase JSON (`ApiBaseUrl`, `EndpointId`, `EnrollmentToken`), then registry. Roadmap calls for JSON authoritative, and old docs use different file/key casing. |
| Credential persistence | Partial/contradictory | `OfflineBuffer.cs` uses DPAPI LocalMachine but stores encrypted device credentials in `C:\ProgramData\SentinelPulse\agent.json`, while active configuration uses `...\Agent\config.json`. It has no visible dequeue/retry/replay method. |
| Offline reliability | Partial | SQLite enqueue exists, but queue schema only has payload and created_at; no attempt count, retry schedule, sent/dead-letter state, pruning, replay, or data-gap implementation is visible in the file. |
| Backend telemetry persistence | Failed for production truthfulness | `backend/go/internal/telemetry/worker.go` hardcodes tenant `org-tenant-default`, CPU/RAM/disk values `50/60/40`, IP `127.0.0.1`, and OS `Windows 11 Pro`; it does not persist real per-tenant metrics from the payload. |
| Tenant isolation | Failed/unverified | Schema has tenant columns and membership tables, but telemetry worker bypasses request/endpoint tenant context with a hardcoded tenant. End-to-end cross-tenant authorization is not proven. |
| MSI builder architecture | Operationally fragile | Existing architecture review documents an asynchronous Windows PowerShell runner and queue as a major friction point. Current runner became online only after correcting `/api/v1` base path. Trusted signing and host tooling remain environment-sensitive. |
| Authentication session persistence | Failed | Go login returns only a short-lived JSON access token; no refresh cookie, refresh endpoint, or startup session restore exists in `auth_handler.go`. Browser refresh logs the user out. |
| Dashboard telemetry | Unverified/failed for real data | Portal rendered with zero endpoints/metrics in the tested state; no fresh real WMI metric evidence was observed. Existing browser logs include past React runtime errors and chart zero-size warnings. |
| WMI/diagnostics breadth | Unverified | Agent README claims broad collectors (hardware, SMART, OS health, reliability, drivers, software, performance, event logs), but end-to-end collection and persistence are not proven. |
| Migration readiness | Failed/partial | Multiple migrations and documentation exist, but the roadmap itself still lists universal MSI, enrollment exchange, WMI ingestion, DPAPI persistence, and E2E acceptance as pending. |

## High-Confidence Critical Gaps

1. **The tested MSI was not self-sufficient.** It installed the service but left loopback URL and no enrollment token in the active config.
2. **The telemetry worker currently fabricates core metrics and hardcodes tenant identity.** This is a release-blocking correctness and security problem even if the agent sends valid data.
3. **Version identity is split.** MSI/Product Version is 2.4.5 while the executable file version is 1.0.0.
4. **Signing is not production-ready.** Trusted signing is unavailable on the runner; the successful artifact was explicitly unsigned test mode.
5. **Authentication is not refresh-safe.** The browser session depends on React memory state and a 15-minute access token without refresh persistence.

## Remaining Audit Work

The final audit still needs source-level verification of Docker topology, all API handlers and authorization paths, collector implementation coverage, export/report endpoints, diagnostics/audit events, tests/build scripts, and current runtime/database evidence. No remediation should be called complete until these gaps are individually validated.

## Additional Evidence

| Area | Status | Evidence and implication |
|---|---|---|
| Local Docker dependency ordering | Partial | `deployment/docker-compose.yml` has PostgreSQL/Redis health checks and backend `depends_on` conditions; frontend only waits for backend container start, not backend readiness. |
| Secret handling in local compose | Failed for production defaults | Compose exposes PostgreSQL and Redis ports and contains fallback credentials such as `secure_postgres_password_change_me` and `production_jwt_secret_change_me_32_bytes_min`. These are unsafe defaults for migration/production unless deployment rejects them. |
| Artifact persistence | Partial | Backend mounts `../agent/artifacts` read-only, but production compose does not mount an artifact directory or configure MSI builder credentials, so the portal build/download workflow is not portable to that topology. |
| Migration execution | Partial | SQL migrations exist and are additive, but the compose init mount only executes on a fresh PostgreSQL volume; existing volumes require an explicit migration runner/process. |
| Frontend/server tests | Partial | Local `pnpm test` passed 14 tests across 6 files. These are mostly portal/server tests; they do not prove Windows WMI, MSI install, signing, enrollment, telemetry truthfulness, or cross-tenant isolation. |
| Production build | Unverified/failed in audit run | Vite transformed 2399 modules but the command stalled before an exit code and was stopped. A clean reproducible production-build result is therefore not currently evidenced by this run. |
| Existing runtime logs | Failed/known defects | Browser logs contain historical invalid-hook-call/React runtime errors, failed HMR reloads, and chart zero-size warnings. These should not be treated as resolved without current route-by-route browser validation. |
| Production architecture consistency | Failed | `PRODUCTION_ARCHITECTURE.md` describes Fastify ingestion and Node workers, while the active backend source reviewed is Go with Redis worker logic. Documentation and implementation describe different production topologies. |

## Audit Interpretation

The platform has meaningful scaffolding and several working components, but it is not yet migration-ready as a single coherent system. The strongest working slice is local portal authentication/setup, Docker health, queue-backed Windows runner communication after URL correction, MSI product-version packaging, and Windows service registration. The critical non-working slice is zero-manual enrollment into a real tenant, correct dynamic configuration on the installed endpoint, real telemetry persistence, tenant-safe processing, production signing, and refresh-safe portal authentication.

## Local primary runtime evidence — 2026-08-23

The connected local Docker deployment has `sentinelpulse_frontend`, `sentinelpulse_backend`, `sentinelpulse_db`, and `sentinelpulse_redis`; backend readiness returned HTTP 200. The local Redis stream `sentinelpulse:telemetry` contained 2,596 entries before the worker fix and had no consumer group, proving the backend process was not starting the existing persistence worker. The local backend `main.go` was corrected to launch `telemetry.NewWorker(...)`; the backend was rebuilt with `docker-compose -f deployment/docker-compose.yml up -d --build backend`. After restart, consumer group `sentinelpulse:persistence` had one consumer, pending 0, lag 0, and the database contained 10 metric rows.

The local worker initially persisted `tenant_id=org-tenant-default` and hardcoded CPU/RAM/Disk values `50/60/40`. The local worker was then corrected to parse `cpu_utilization`, `ram_utilization`, and `disk_utilization` from the agent payload and resolve `tenant_id` from the `endpoints` table. The newest verified row used tenant `org-20260813205347.229942651`, endpoint `DESKTOP-1E02MC9`, CPU 37, RAM 49.17, and Disk 11.94.

The local portal subsequently returned to its login page when navigating to `/endpoints`, so the dashboard UI still requires a refresh-safe auth-session fix. Earlier authenticated portal evidence showed the runner online, v2.4.5 unsigned MSI succeeded, and no trusted certificate was reported. Local Windows enrollment provisioning required elevation; after elevation, the service was Running/Automatic and backend enrollment credential existed, while the original script had failed to replace config.json and used noncanonical JSON keys.
