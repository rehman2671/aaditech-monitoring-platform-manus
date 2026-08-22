# SentinelPulse Complete Requirements, Dependencies, and Implementation Audit

**Audit date:** 23 August 2026  
**Scope:** Windows Endpoint Monitoring & Diagnostics Platform, local Docker deployment, Go control/ingestion backend, React portal, .NET Windows agent, MSI/ WiX build runner, authentication, telemetry, diagnostics, exports, and migration readiness.

## Executive Conclusion

SentinelPulse has a substantial working foundation, but it is **not yet an end-to-end migration-ready production platform**. The portal, setup flow, Docker health, MSI queue, Windows runner heartbeat, MSI product-versioning, Windows service registration, report-generation utilities, and several unit tests are present. However, the critical business path—**install a universal MSI, automatically enroll a real endpoint into the correct tenant, collect real WMI metrics, persist them without fabrication, and display them reliably in the portal**—is not currently proven and is contradicted by source evidence.

The most important finding is that the successful local test installed **MSI/Product Version 2.4.5.0**, but the active configuration contained `http://127.0.0.1:8080` and no enrollment token. The service was running, yet the endpoint was not demonstrably enrolled or sending real metrics. Separately, the Go telemetry worker currently hardcodes tenant and metric values, which makes the ingestion path unsuitable for production even if the agent sends valid telemetry.

> **Release decision:** Do not declare SentinelPulse migration-ready. The project should remain in remediation until the P0 acceptance test passes with real, non-fabricated telemetry and tenant-scoped persistence.

## Status Legend

| Status | Meaning |
|---|---|
| **Complete** | Direct code and/or runtime evidence supports the requirement. |
| **Partial** | Some implementation exists, but important production behavior is absent or inconsistent. |
| **Failed** | A direct test or source inspection demonstrates that the requirement does not currently work. |
| **Missing** | No credible implementation evidence was found. |
| **Unverified** | Documentation or scaffolding exists, but there is no trustworthy end-to-end evidence. |

## 1. Requirements-to-Implementation Matrix

| Requirement | Status | Evidence | Consequence |
|---|---|---|---|
| Multi-tenant organizations and memberships | **Partial** | Schema contains `organizations`, `memberships`, tenant columns, and setup creates an organization. | Tenant model exists, but processing and authorization are not proven consistently across all APIs. |
| Strict tenant isolation | **Failed** | `backend/go/internal/telemetry/worker.go` writes hardcoded `org-tenant-default` for metrics and endpoint stubs. | Cross-tenant data contamination is possible; this is a security and correctness blocker. |
| First-run setup with company, username/email, password, and local IP | **Partial** | `auth_handler.go` accepts and stores these fields. | Setup works structurally, but local IP is not reliably propagated into future MSI builds. |
| Login | **Complete for initial request** | Go login validates password and issues a 15-minute JWT. | Initial login works, but session persistence does not. |
| Session survives browser refresh | **Failed** | `auth_handler.go` returns JSON only; no refresh cookie, refresh route, or session restore exists. | User is logged out on refresh and must authenticate again. |
| Universal MSI without rebuild for server URL changes | **Failed in tested install / Partial in source** | Build scripts support config generation, but the installed 2.4.5 config used loopback and had no token. | The principal zero-manual requirement is not reliably achieved. |
| Dynamic enrollment token exchange | **Unverified/Failed in tested path** | Enrollment endpoint and token tables exist, but the installed config had no usable token and no device credential evidence. | Service runs without a valid identity and cannot produce tenant-scoped telemetry. |
| Runtime endpoint identity | **Partial** | Endpoint ID `DESKTOP-1E02MC9` was present in the generated config. | Shared-installer behavior and machine-name runtime assignment are not fully proven. |
| Windows service installation | **Complete for tested host** | `SentinelPulseAgent` was `Running` with `Automatic` startup; Programs & Features showed the agent. | Installation/registration works for the tested artifact. |
| MSI product version | **Partial** | Programs & Features showed `2.4.5.0`; downloaded filename was `SentinelPulseAgent-2.4.5-x64.msi`. | Release identity is correct at MSI level, but executable metadata remained `1.0.0.0`. |
| Agent executable version synchronization | **Failed** | Installed `SentinelPulse.Agent.exe` reported Product/File Version `1.0.0/1.0.0.0`. | Support and rollback cannot reliably identify the running agent version. |
| Trusted Authenticode signing | **Failed** | Runner reported no trusted certificate; self-signed attempt failed with SignTool “No certificates were found”. | Production trust and enterprise deployment are blocked. |
| Self-signed test mode | **Failed on this runner** | The self-signed job failed because the certificate was not usable by SignTool. | Test signing is not actually automated despite UI availability. |
| Unsigned functional MSI | **Complete for one test artifact** | `2.4.5` unsigned build succeeded; SHA-256 was `96D25EA7734F29370A2DF7E922E5F4D66D6C80857B2EDA09D061740AFF8F446F`. | Functional testing can proceed, but Windows trust warnings are expected. |
| MSI download path | **Complete for tested artifact** | Portal exposed Download MSI and browser reported download started. | Artifact handoff works when a build succeeds. |
| Build queue/runner heartbeat | **Partial** | Runner was initially offline due to wrong base path; corrected `/api/v1` runner became online and accepted a job. | Queue depends on fragile host command/configuration and is not yet zero-manual. |
| Real CPU/RAM/disk metrics | **Failed in backend persistence** | Telemetry worker inserts hardcoded `50.0/60.0/40.0` rather than parsing real values. | Dashboard values cannot be treated as real endpoint measurements. |
| Real hardware inventory | **Unverified** | Agent documentation describes WMI/CIM collectors, but no end-to-end stored evidence was found. | CPU/GPU/BIOS/serial/disk/battery/peripherals coverage is not acceptance-tested. |
| Offline buffering | **Partial** | SQLite enqueue exists in `OfflineBuffer.cs`. | No visible dequeue, replay, retry metadata, pruning, or data-gap mechanism exists in that file. |
| Network retry and backoff | **Partial** | Portal/LLM helper tests include durable-store behavior; agent buffer does not show a replay loop. | Backend-side test coverage does not prove agent-side delivery durability. |
| Device credential protection | **Partial** | DPAPI LocalMachine protection exists. | Credential is written to legacy `ProgramData\SentinelPulse\agent.json`, inconsistent with active `Agent\config.json`. |
| Diagnostic logging | **Partial** | Diagnostic reports, runner logs, and Windows event logging are present. | A unified correlation ID and complete build/install/enrollment/telemetry trace is not proven. |
| Alerts and threshold rules | **Partial** | Schema, portal pages, and health-score/report tests exist. | Real alert evaluation on real endpoint metrics is not proven. |
| CSV/PDF export | **Complete at utility/test level; runtime unverified** | `reports.test.ts` verifies CSV and PDF generation. | Portal download authorization and tenant-scoped production report contents need runtime testing. |
| Dashboard and real-time stream | **Partial** | React dashboard and live-stream controls exist. | Tested portal showed zero endpoints; historical logs contain React hook and chart sizing errors. |
| API ingestion error handling | **Partial** | Durable ingestion store tests cover idempotency, dead-letter, and stale heartbeat behavior. | These tests are not equivalent to proving the active Go ingestion path under network interruption. |
| Database migrations | **Partial** | Three additive SQL migrations exist. | Existing Docker volumes require explicit migration execution; init-directory mounting alone is insufficient after first initialization. |
| Docker startup | **Partial** | PostgreSQL/Redis health checks and backend dependency conditions exist. | Frontend waits only for backend container startup, not readiness. Production compose lacks artifact/runner configuration. |
| Secrets and production defaults | **Failed for production hardening** | Compose contains fallback database/JWT values and exposes PostgreSQL/Redis ports. | Deployment can start with unsafe defaults unless blocked by preflight validation. |
| Automated tests | **Partial** | Local portal suite passed 14 tests in 6 files. | Tests do not cover Windows WMI, MSI installation, signing, real enrollment, real telemetry, or tenant isolation. |
| Production build reproducibility | **Unverified** | Vite transformed 2399 modules, but the combined build command stalled before final exit. | CI/release cannot rely on the current evidence. |

## 2. Dependency Audit

### Windows build-host dependencies

The MSI runner depends on Windows PowerShell behavior, .NET 8 SDK/runtime, WiX v4, SignTool/Windows SDK, a usable certificate/private key, filesystem permissions, service elevation, and a reachable backend URL. Existing evidence confirms PowerShell 5.1 incompatibility in key generation (`RandomNumberGenerator.Fill`), user-profile-sensitive WiX discovery, and certificate discovery/signing failures. These dependencies need a deterministic preflight command that fails before queueing a job and reports each dependency separately.

### Runtime dependencies

The agent depends on a valid JSON configuration, an enrollment token registered in the active tenant, network reachability to the backend, correct API paths, LocalSystem access to WMI/Event Log/DPAPI, and a functioning ingestion worker. The tested installation failed this chain at configuration/enrollment: the active file had loopback URL and no token.

### Platform dependencies

The backend depends on PostgreSQL/TimescaleDB, Redis Streams, JWT key material, and a persistent artifact directory. The local compose file provides health checks and persistence, but production compose does not reproduce the MSI artifact mount or builder key configuration. This means “works locally” and “migration topology” are currently different systems.

## 3. Architecture Findings

The repository contains two competing architecture descriptions. `PRODUCTION_ARCHITECTURE.md` describes a Fastify ingestion gateway and Node.js workers, while the active reviewed backend is Go and contains a Go Redis stream worker. The deep architecture review correctly identifies the operational fragility of asynchronous Windows compilation from a portal queue, but the implementation still relies on that queue for normal MSI generation.

The target architecture should be a **universal, signed, prebuilt MSI plus dynamic enrollment**. The current implementation remains a hybrid: some scripts generate `config.json` at build time, WiX writes registry bootstrap values, the agent reads environment variables before JSON, and DPAPI credentials are written to another legacy file. This boundary mismatch is the principal source of repeated configuration failures.

## 4. Security and Tenant-Isolation Findings

Tenant columns and membership tables are necessary but not sufficient. The telemetry worker must derive tenant identity from a validated device credential mapped to an endpoint, then verify that the endpoint belongs to the same tenant before inserting metrics or updating status. Hardcoded tenant IDs and endpoint stubs must be removed.

The current local compose defaults are unsafe for any migration target. Deployment must reject placeholder database passwords, placeholder JWT secrets, missing RS256 keys where required, and HTTP URLs outside explicitly allowed local-development mode. The unsigned MSI must be clearly labeled as test-only and must never be presented as production trusted.

The login flow needs a secure session design: a short-lived access token plus an HttpOnly refresh cookie, rotation/revocation, CSRF-safe same-site policy, and a startup `/auth/me` or `/auth/refresh` call. Storing the current access token only in React state is the direct reason refresh logs the user out.

## 5. P0 Release Blockers

| Priority | Blocker | Required evidence to close |
|---|---|---|
| P0 | Real tenant-scoped telemetry | A freshly enrolled endpoint has rows in `endpoint_metrics_hyper` with values parsed from the agent payload, the correct tenant ID, endpoint ID, and current timestamps. |
| P0 | No fabricated metrics | Worker tests must prove CPU/RAM/disk values equal payload values and reject malformed payloads. |
| P0 | Dynamic config/enrollment | A clean MSI install with server URL and enrollment token results in a valid device credential stored via DPAPI and no manual post-install configuration. |
| P0 | Correct artifact identity | MSI ProductVersion, EXE ProductVersion, manifest version, service file version, and portal version all equal the requested release. |
| P0 | Production signing | Trusted certificate is installed and SignTool verification returns `Valid`; certificate subject/thumbprint/expiry are recorded. |
| P0 | Tenant authorization | Cross-tenant endpoint, metrics, alert, command, and export access tests return forbidden/not found without leakage. |
| P0 | Refresh-safe authentication | Login, hard refresh, protected route navigation, token expiry/rotation, and logout all pass browser/API tests. |

## 6. Recommended Remediation Sequence

### Phase A — Establish one canonical runtime contract

Choose one configuration file path and one schema. Recommended canonical path: `C:\ProgramData\SentinelPulse\Agent\config.json`, with camelCase or PascalCase used consistently everywhere. Define explicit precedence, preferably JSON as the deployment source of truth with environment variables reserved for controlled overrides. Store the enrollment token only for bootstrap, clear it after successful exchange, and store the device credential in a separate DPAPI-protected file with an explicit version and owner identity.

### Phase B — Fix backend truth and isolation

Change telemetry processing to validate device credentials, resolve endpoint and tenant from the database, parse actual payload metrics, and insert those values. Remove `org-tenant-default`, `127.0.0.1`, `Windows 11 Pro`, and `50/60/40` defaults from production ingestion. Add database constraints and integration tests for tenant mismatch, duplicate delivery, malformed payloads, and retry/dead-letter behavior.

### Phase C — Make MSI universal and version-consistent

Compile the agent once per release, inject only safe bootstrap parameters or use a post-install enrollment contract, and ensure the same version is written into the .NET project, executable metadata, MSI ProductVersion, manifest, and portal job. Add a runner preflight that checks .NET SDK, WiX, SignTool, certificate presence, certificate trust, output directory, and backend reachability before claiming a job.

### Phase D — Make authentication persistent and operationally safe

Implement refresh sessions in the Go backend, issue an HttpOnly cookie, add `/auth/refresh`, `/auth/me`, and `/auth/logout`, and restore the frontend session on startup. Keep access tokens short-lived and rotate refresh tokens. Add tests for refresh, revocation, expired sessions, and browser reload.

### Phase E — Prove the endpoint contract

On a clean Windows machine, run one acceptance test from portal queue to install: build, checksum, signature, download, silent install, service start, automatic enrollment, DPAPI credential creation, first heartbeat, first real WMI payload, database row, and dashboard rendering. Capture a correlation ID across portal job, runner log, MSI log, agent log, backend log, and database row.

### Phase F — Harden migration packaging

Make production compose include the actual backend, frontend, database, Redis, migrations, secrets, health checks, artifact storage, and TLS/reverse-proxy path that the migration guide describes. Remove placeholder secret fallbacks in production mode. Add a preflight that blocks startup when required secrets, migrations, or artifact paths are missing.

## 7. Acceptance Test Checklist

| Test | Pass condition |
|---|---|
| Fresh setup | Company, admin, password, and server URL persist transactionally. |
| Browser refresh | Authenticated protected route remains accessible after hard reload. |
| Build preflight | Runner reports every prerequisite before accepting a job. |
| MSI artifact | Filename, MSI version, EXE version, manifest, and checksum agree. |
| Signature | Trusted installation returns a valid Authenticode signature. |
| Install | MSI exits 0 and service is Automatic/Running. |
| Bootstrap | Agent reads canonical config, enrolls once, clears bootstrap token, and stores DPAPI device credential. |
| Telemetry | Real CPU/RAM/disk/WMI values are stored under the correct tenant and endpoint. |
| Dashboard | Endpoint becomes online and charts display stored values without fabricated defaults. |
| Offline recovery | Network interruption queues telemetry, retries with backoff, replays in order, and records a data gap if retention is exceeded. |
| Tenant isolation | Tenant A cannot read, export, alert on, or command Tenant B resources. |
| Upgrade/rollback | Version upgrade preserves identity and config; rollback restores the previous known-good service. |

## Final Assessment

SentinelPulse is **not a failed project**, but it is currently a prototype-to-production transition with a working shell rather than a completed end-to-end platform. The evidence supports continuing development, but not migration or production rollout. The fastest safe path is not repeated MSI rebuilds; it is first fixing the canonical enrollment/config contract and backend telemetry truth, then proving the acceptance test on one clean endpoint. Only after that should trusted signing, multi-tenant hardening, and broad fleet rollout be treated as release work.

## Internal Evidence References

1. `sentinelpulse_deep_architecture_review.md` — architecture and target universal-MSI analysis.
2. `sentinelpulse_msi_gap_audit.md` — PowerShell, WiX, and signing dependency findings.
3. `sentinelpulse_diagnostic_report.md` — prior local Windows enrollment failure evidence.
4. `todo.md` — honest roadmap showing unresolved acceptance items.
5. `agent/src/SentinelPulse.Agent/AgentConfiguration.cs` — actual configuration precedence.
6. `agent/src/SentinelPulse.Agent/OfflineBuffer.cs` — actual SQLite/DPAPI implementation.
7. `backend/go/internal/telemetry/worker.go` — actual tenant and metric persistence behavior.
8. `backend/go/internal/api/auth_handler.go` — actual login/session behavior.
9. `deployment/docker-compose.yml` and `infra/docker-compose.prod.yml` — local and production topology differences.
10. `server/reports.test.ts` and `server/ingestion-durable.test.ts` — current portal/server test coverage.
