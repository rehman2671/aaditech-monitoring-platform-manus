# SentinelPulse Gap-Closure and Migration-Readiness Plan

**Prepared:** 23 August 2026  
**Primary source of truth:** `C:\Users\Admin\Documents\Aaditech_Monitoring_Platform` and its local Docker/Windows runtime.  
**Decision:** The platform is not yet migration-ready. The plan below converts every current Partial, Failed, Unverified, and Not Fixed item into an implementation workstream with a measurable exit gate.

## 1. Executive assessment

The local deployment has a functioning foundation: Docker services can start, the Go backend can become ready, Redis Streams can carry telemetry, the persistence worker can consume messages, the MSI can install a Windows service, and the portal can authenticate initially. The product acceptance path still fails because the user-facing portal shows zero endpoints while backend persistence evidence exists, login sessions are lost after refresh, the tested MSI was unsigned, and package and executable version metadata are inconsistent.

The central architectural problem is **contract fragmentation**. There are multiple configuration paths, multiple authentication assumptions, competing portal/backend data paths, and a write path that was repaired before the read path was proven. The remediation must therefore start with one canonical contract and one observable acceptance path, not with another isolated patch.

Microsoft's installer guidance explicitly calls for secure package sources, unattended installation, verbose logging during troubleshooting, thorough package testing, validation-error closure, and a tested servicing strategy [1]. Microsoft's current signing guidance states that MSI/EXE distribution requires the publisher to sign the installer, and that self-signed certificates are unsuitable for public distribution [2]. Microsoft's Worker Service guidance recommends a published executable, Windows Service registration, Event Log visibility, and configured service recovery behavior [3]. OWASP recommends deriving tenant context from verified authentication, never trusting client-supplied tenant IDs, applying tenant checks at the data layer, and testing cross-tenant access [4].

## 2. Target architecture

The target is a **universal, versioned, signed MSI with runtime enrollment**. The MSI contains the agent binary and a minimal bootstrap configuration only. The server URL is changeable without rebuilding the binary. A tenant enrollment token is exchanged once for a device credential; the bootstrap token is then removed or rendered unusable. The device credential is stored in a separate DPAPI-protected file. Every telemetry message is authenticated by that device credential; the backend resolves endpoint and tenant from the credential, never from a request-supplied tenant ID.

The portal and backend must consume the same PostgreSQL/TimescaleDB truth used by the telemetry worker. The endpoint list, dashboard aggregates, alerts, exports, and live stream must all use the same authenticated tenant-scoped repository. Redis is a transport and retry buffer, not a second source of truth. The worker must be started by the backend process or an explicitly supervised service, and its consumer group must be health-checked.

The local deployment remains the primary implementation target because it requires Docker, a Windows runner, WiX, SignTool, certificate stores, service control, and OS-level verification. A managed web deployment can later host the portal/API, but it cannot replace the local Windows build host and endpoint acceptance test.

## 3. Requirement status and closure map

| Area | Current status | Closure deliverable | Required evidence |
|---|---|---|---|
| Local source of truth | Partial | Local repository, local compose files, runner, and installed endpoint documented as one environment | Reproducible commands and commit/checkpoint from local root |
| Docker startup | Partial | Readiness-gated frontend/backend startup, persistent DB/Redis/artifact volumes, no unsafe fallback secrets | Clean start/stop/start test and health report |
| Authentication | Not fixed | HttpOnly refresh session, `/auth/me`, `/auth/refresh`, `/auth/logout`, rotation and revocation | Login, hard refresh, expiry, logout, and protected-route tests |
| Tenant isolation | Failed/Partial | Credential-derived tenant context and tenant-scoped repositories on all reads/writes | Cross-tenant API/database tests with no leakage |
| Agent configuration | Partial | One schema/path, explicit precedence, atomic write, schema validation, bootstrap cleanup | Clean install with URL/token; final config and DPAPI evidence |
| Enrollment | Partial | Idempotent token exchange, one-time/expiry/revocation rules, device credential binding | Fresh token exchange and duplicate/replay tests |
| Telemetry ingestion | Partial | Parsed payload values, authenticated endpoint lookup, idempotency, retry/DLQ, worker health | Payload-to-row equality and retry interruption test |
| Portal endpoint read path | Failed | Endpoint API, tenant query, frontend mapping, and DB connection reconciled | Screenshot/API response showing `DESKTOP-1E02MC9` and metrics |
| MSI versioning | Partial/Failed | One release version propagated to .NET assembly, EXE, manifest, MSI, queue, and portal | `2.4.6` or later equality report across all artifacts |
| Code signing | Failed | Trusted certificate/private key integration or explicitly test-only certificate flow | SignTool `Valid`, thumbprint, subject, expiry, chain report |
| Runner | Partial | Preflight, durable heartbeat, bounded logs, service recovery, no fragile PowerShell assumptions | Offline/online transition and failed-preflight test |
| Hardware inventory | Unverified | Real WMI/CIM collectors with capability/error states | Clean-machine inventory fixture and endpoint evidence |
| Offline buffer | Partial | Durable queue replay, backoff, deduplication, pruning, encryption/ownership | Network interruption and replay test |
| Dashboard/realtime | Failed at acceptance | Shared read model, polling/SSE/WebSocket contract, error states | Non-empty endpoint list and live metric update |
| Alerts | Partial | Real metric evaluator with tenant scope and deduplicated alert lifecycle | Threshold crossing creates/resolves correct alert |
| CSV/PDF export | Utility-complete, runtime unverified | Authenticated tenant-scoped export endpoints | Export contents match visible tenant data |
| Diagnostics | Partial | Correlation ID across MSI job, install, enrollment, ingress, worker, and UI | One trace ID joins all logs |
| Migration readiness | Not ready | Rehearsed clean deployment, migration runner, secrets validation, rollback | Fresh environment runbook and go/no-go report |

## 4. Dependencies and preflight

### 4.1 Local Windows build host

The runner requires Windows PowerShell 5.1 compatibility, .NET 8 SDK/runtime, WiX v4, Windows SDK SignTool, certificate/private-key access, administrator rights for service and certificate operations, write access to the artifact directory, and network reachability to the backend. The preflight must test each item independently and emit machine-readable JSON. It must fail before queue acceptance if any mandatory dependency is absent.

The PowerShell implementation must avoid APIs unavailable in Windows PowerShell 5.1, including the previously observed `RandomNumberGenerator.Fill` behavior. Use a compatible byte-generation path or invoke a supported cryptographic command. The runner should be installed as a Windows service with automatic restart and Event Log output, following Microsoft's Worker Service deployment model [3].

### 4.2 Local Docker stack

The backend depends on PostgreSQL/TimescaleDB, Redis Streams, JWT key material, and a persistent artifact directory. Compose must use health checks and readiness dependencies rather than container-start ordering. Production-like mode must reject placeholder passwords, placeholder JWT values, absent key pairs, missing artifact mounts, and an HTTP URL unless local-development mode is explicitly enabled.

Database migrations must be explicit and repeatable. Initialization-directory scripts are insufficient for an already-initialized volume. The deployment runbook must run migrations against the existing local database, verify schema version, and fail on pending migrations.

### 4.3 Agent runtime

The agent requires a valid canonical JSON configuration, network access to the backend, a fresh enrollment token, LocalSystem access to WMI/Event Log/DPAPI, and a running service. The configuration loader must validate URL scheme, token format, endpoint identity, and schema version before starting the telemetry loop. Configuration writes must be atomic: write a temporary file, flush, replace the target, and retain a bounded backup. No script may use `Move-Item` in a way that fails when the destination already exists.

## 5. Phase-wise implementation sequence

### Phase 0 — Freeze evidence and establish the local baseline

Create a local evidence bundle containing repository commit/hash, compose project names, container IDs and health, image IDs, Windows product version, service state, executable file version, active config keys with token values redacted, runner version, database schema version, Redis stream/group state, and portal URL. Record a correlation ID for every subsequent test. Do not delete existing artifacts or database rows during this phase.

**Exit gate:** Two consecutive baseline captures produce the same topology, and every observed mismatch is written to the local audit log. A rollback copy of configuration and compose files exists.

### Phase 1 — Canonical contracts and data model

Define one shared contract document for agent configuration, enrollment request/response, device credential, telemetry envelope, endpoint projection, metric names, error codes, and version metadata. Recommended canonical files are `C:\ProgramData\SentinelPulse\Agent\config.json` for non-secret bootstrap settings and a separate DPAPI-protected credential file for the device credential. Use one casing convention and one schema version.

Add schema validation at agent startup and backend ingress. Add database constraints and indexes for `(tenant_id, endpoint_id, observed_at)`, credential uniqueness, token expiry/revocation, and idempotency keys. Define retention and pruning policies for high-volume telemetry.

**Tests:** configuration precedence, malformed JSON, invalid URL, token format, atomic replacement, credential ownership, duplicate envelope, and schema migration from the current installed format.

**Exit gate:** A contract fixture can be serialized by C#, decoded by Go, stored in PostgreSQL, and projected back to the portal without field-name translation or default substitution.

### Phase 2 — Secure enrollment and tenant isolation

Make enrollment token exchange explicit and idempotent. The token must be tenant-scoped, time-limited, revocable, one-time or replay-protected, and stored hashed at rest. The exchange must bind the endpoint identity to the tenant and issue a device credential with a key ID/version. After success, the bootstrap token must be removed from the active configuration.

In the backend, derive tenant context only from the authenticated device credential or verified user session. Never accept `tenant_id` as authoritative from a client header, query parameter, or telemetry payload. Every endpoint, metric, command, alert, and export query must include tenant scope at the repository/data layer. Add negative tests for another tenant's endpoint ID, metric ID, command, alert, and export.

**Exit gate:** A newly enrolled endpoint can authenticate; replaying the enrollment token fails; a credential from tenant A cannot read or write tenant B; no default tenant string remains in production code or persisted metrics.

### Phase 3 — Real telemetry and durable ingestion

Keep Redis Streams as transport, but make the worker production-correct. The worker must parse CPU, memory, disk, timestamps, inventory, and collector error fields from the actual agent envelope. It must resolve the endpoint and tenant from the credential lookup, reject mismatches, use idempotency keys, acknowledge only after a successful database transaction, and send poison messages to a dead-letter stream with an error reason.

Implement bounded retry with exponential backoff and jitter for transient database/Redis errors. Do not retry authentication failures or malformed payloads indefinitely. Expose consumer lag, pending count, oldest pending age, dead-letter count, accepted count, rejected count, and last successful persistence time through health/diagnostic endpoints.

**Tests:** exact payload-to-column equality; malformed payload rejection; tenant mismatch rejection; duplicate delivery; database outage; Redis reconnect; dead-letter; recovery replay; clock skew; oversized payload; and graceful shutdown.

**Exit gate:** Ten freshly collected real samples produce ten tenant-correct rows with values equal to the agent payload, and an induced backend interruption results in eventual replay without duplicates or loss.

### Phase 4 — Reconcile portal read path with backend truth

Trace the exact request made by the local Endpoints page and Dashboard. Verify HTTP status, response body, authorization header/cookie, tenant claim, backend process, database connection string, SQL query, and frontend mapping. Remove silent fallback-to-empty behavior: a 401, 403, 5xx, schema mismatch, or decode error must render an actionable error state, not “0 endpoints.”

Refactor endpoint list, dashboard aggregates, alerts, exports, and live stream to use one tenant-scoped API/repository. Ensure the endpoint projection is created/updated by enrollment/telemetry and is readable by the same tenant session used by the portal. Add a visible data freshness timestamp and API correlation ID in diagnostics.

**Exit gate:** With the authenticated local browser, hard refresh, open Dashboard, open Endpoints Fleet, and navigate to the endpoint detail. The UI must show `DESKTOP-1E02MC9`, online state, last seen, and real CPU/RAM/disk values. A failed API must be visibly reported rather than converted to an empty list.

### Phase 5 — Refresh-safe authentication

Replace React-state-only authentication with a short-lived access token plus an HttpOnly refresh cookie. Implement `/auth/me`, `/auth/refresh`, and `/auth/logout`; rotate refresh tokens, revoke on logout, detect reuse, and apply SameSite/Secure policy appropriate to local HTTP development versus HTTPS deployment. Store only non-sensitive UI state in the browser; do not put long-lived bearer credentials in localStorage.

On application startup, restore the session through `/auth/me` or `/auth/refresh` before rendering protected routes. Distinguish “loading,” “unauthenticated,” and “API unavailable.” Add CSRF protection for cookie-authenticated state-changing requests.

**Exit gate:** Login → hard refresh → protected route → wait for access expiry → automatic refresh → logout → hard refresh all produce the expected state. Browser console contains no repeated 401 loop.

### Phase 6 — MSI universal packaging and release identity

Make the MSI universal: do not compile a machine-specific endpoint name into the package unless the user explicitly chooses a single-host test. The shared installer must receive the server URL and enrollment token through a controlled bootstrap mechanism or obtain them from a secure enrollment flow. Any public MSI properties must be validated and logged without exposing secrets.

Synchronize the release version across `.csproj` assembly/file/informational versions, agent manifest, WiX `ProductVersion`, artifact filename, build job, portal display, and installed product metadata. The release gate must inspect the MSI database, installed product registry, EXE version resources, and service binary path. A mismatch fails the build and prevents download.

**Exit gate:** A clean Windows VM installs version `X.Y.Z`; Programs & Features, MSI database, EXE file properties, service diagnostics, and portal job all report the same version. No stale artifact can be downloaded as “latest.”

### Phase 7 — Trusted signing and runner operations

Separate signing modes: `trusted_production`, `self_signed_internal_test`, and `unsigned_functional_test`. The portal must label them clearly and reject production mode when a trusted chain is absent. Self-signed mode is only for controlled machines where the root certificate is deliberately installed; it is not production trust [2].

For production, use a certificate that chains to a trusted CA or an approved managed signing service. Keep private keys outside source control, restrict access to the runner identity, record thumbprint/subject/expiry, and verify the MSI and executable signatures with SignTool before artifact publication. The runner should have a Windows service wrapper, heartbeat, preflight, structured log files, rotation, and failure recovery.

**Exit gate:** Trusted mode returns SignTool `Valid`, certificate chain and expiry are recorded, the portal blocks unsigned production artifacts, and a runner restart recovers heartbeat without manual process hunting.

### Phase 8 — Hardware inventory and collector capability model

Implement collectors as independent modules for CPU, RAM, GPU, motherboard, BIOS/UEFI, serial/asset ID, disk model/type/capacity/free/health, battery health/capacity/charge/status/cycles, network adapters, Wi-Fi/Ethernet, peripherals, and OS build. Use WMI/CIM only where the OS exposes a reliable value; report `unsupported`, `permission_denied`, `unavailable`, or `error` rather than inventing a value.

Separate inventory snapshots from high-frequency metrics. Version the inventory schema and cap payload size. Collectors must have timeouts so one slow WMI provider cannot stop the whole agent.

**Exit gate:** A clean Windows endpoint produces a timestamped inventory with real values or explicit capability states, and the portal displays the fields without fabricated defaults.

### Phase 9 — Offline durability, diagnostics, alerts, exports, and realtime

Complete the agent offline buffer with durable enqueue, replay ordering, exponential backoff, maximum age, size limits, deduplication, encryption/ACL review, and a diagnostic count of queued/dead-lettered items. Add a network interruption acceptance test.

Create one correlation ID from MSI build job through runner, installation, enrollment, ingress, worker persistence, and UI request. Redact tokens, passwords, private keys, and full credentials. Provide structured events for each state transition.

Evaluate alerts only from persisted tenant-scoped metrics. Deduplicate active alerts and record open/acknowledge/resolve transitions. CSV/PDF exports must be authenticated, tenant-scoped, bounded, and tested against the same endpoint query as the UI. Live updates may use SSE/WebSocket or bounded polling, but reconnect behavior and stale-data indicators are mandatory.

**Exit gate:** A real threshold crossing creates one alert, CSV/PDF contains only the current tenant's rows, a disconnected agent replays buffered metrics, and the UI shows live updates with a visible last-update time.

### Phase 10 — Migration rehearsal and release certification

Create a clean local deployment rehearsal: empty application database, explicit migrations, generated secrets, Docker start, backend readiness, runner registration, portal setup, token generation, MSI build, checksum/signature verification, silent install, automatic enrollment, telemetry, portal display, export, alert, restart, and rollback. Repeat with a second endpoint and a second tenant.

Document backup/restore for PostgreSQL, Redis stream recovery, artifact retention, certificate rotation, token revocation, service recovery, and version rollback. Do not delete production-like data during testing; use isolated volumes for destructive rehearsal.

**Final go gate:** All P0 criteria pass twice consecutively on clean runs. Any fabricated metric, cross-tenant result, stale artifact, signature failure, silent UI empty state, or manual post-install configuration is an automatic no-go.

## 6. Verification matrix

| Test class | Test | Pass condition |
|---|---|---|
| Build | Queue version X.Y.Z | Job completes only after preflight and artifact validation |
| Artifact | MSI database, filename, EXE resources | All versions equal X.Y.Z |
| Signature | SignTool verification | Trusted mode returns `Valid`; unsigned only allowed in test mode |
| Install | Silent install on clean Windows | Exit 0, service Automatic/Running, no manual edits |
| Config | URL/token bootstrap | Canonical config valid; token cleared after exchange; DPAPI credential present |
| Enrollment | Fresh/replay/expired/revoked token | Fresh succeeds; all others fail safely |
| Telemetry | Real payload to DB | Stored values equal payload; timestamps and tenant correct |
| Resilience | Backend/Redis interruption | Retry/replay succeeds without loss or duplicates |
| Isolation | Tenant A vs tenant B | No cross-tenant read/write/command/export leakage |
| Portal | Dashboard/endpoints/detail | Endpoint and metrics visible after refresh; errors not rendered as zero |
| Auth | Refresh/expiry/logout | Session restores and revokes correctly |
| Inventory | WMI capability matrix | Real values or explicit unsupported/error states |
| Export/alerts | CSV/PDF and threshold | Tenant-scoped output and correct alert lifecycle |
| Operations | Runner/service restart | Heartbeat and worker recover automatically |
| Migration | Clean deployment and rollback | Repeatable setup, migrations, backup, restore, rollback |

## 7. Two viable deployment strategies

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| **Local-first production-like deployment**: Docker backend/database/Redis on the user's server, Windows runner on the build host, universal signed MSI distributed from the artifact store | Best fit for current Docker/WiX/Windows requirements and data locality; requires the server and runner to remain available and requires certificate operations | Existing hardware/software plus certificate cost | High initially, then low after preflight/service automation |
| **Managed portal/API plus local Windows build runner**: host the web/API layer in managed infrastructure while keeping the Windows runner and endpoint path local or connected by secure outbound HTTPS | Easier external access and central availability; introduces network, secret, certificate, and data-residency dependencies; local runner remains mandatory for Windows packaging | Hosting and certificate/service costs | Medium-to-high |
| **Lighter functional-test mode**: local Docker plus unsigned MSI and one endpoint, with trusted signing and second-tenant tests deferred | Fastest way to validate telemetry/read-path correctness; not suitable for customer distribution or migration readiness | Lowest | Medium |

The recommended order is not to choose a deployment destination prematurely. First make the local-first path pass the full acceptance matrix. Only then decide whether the same contracts are moved behind managed hosting.

## 8. Immediate execution order

1. Fix and prove the portal endpoint read path; the screenshot showing zero endpoints is the current acceptance failure.
2. Finish refresh-safe authentication so navigation and hard refresh do not hide valid data.
3. Add endpoint/portal integration tests that use the same local database and tenant context as the worker.
4. Add version-resource synchronization and fail-closed artifact validation.
5. Complete runner preflight and trusted-signing integration; keep unsigned artifacts visibly test-only.
6. Finish WMI inventory, offline replay, alert, export, and diagnostic correlation acceptance tests.
7. Rehearse a clean two-tenant deployment and record the go/no-go report.

## 9. Explicit no-go conditions

The platform must not be called migration-ready if any of the following remains true: the portal renders a valid endpoint as zero; telemetry contains default or fabricated values; tenant identity comes from a client-supplied field; the access session disappears on refresh; a stale MSI can be downloaded; MSI/EXE versions differ; production mode allows an unsigned artifact; enrollment requires manual post-install editing; the runner has no preflight or recovery; migrations depend on a fresh empty volume; or a second tenant can see or alter another tenant's data.

## References

[1]: https://learn.microsoft.com/en-us/windows/win32/msi/windows-installer-best-practices "Windows Installer Best Practices — Microsoft Learn"

[2]: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options "Code signing options for Windows app developers — Microsoft Learn"

[3]: https://learn.microsoft.com/en-us/dotnet/core/extensions/windows-service "Create a Windows Service using BackgroundService — Microsoft Learn"

[4]: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html "Multi-Tenant Application Security Cheat Sheet — OWASP"
