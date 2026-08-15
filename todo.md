# SentinelPulse Production Master TODO

- [x] Phase 0: Architecture Freeze & Documentation (`docs/ARCHITECTURE.md`, `docs/SECURITY_MODEL.md`, `docs/AGENT_PROTOCOL.md`, `docs/DATA_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/THREAT_MODEL.md`)
- [x] Phase 1: Canonical Go Backend & Security Boundary (API routing, auth, RBAC, tenant context middleware, audit log, unit tests)
- [x] Phase 2: PostgreSQL & TimescaleDB Migration (Relational tables, hypertables, token hashing, migration runner, validation SQL script `docs/TIMESCALE_HYPERTABLE_VALIDATION.sql`)
- [x] Phase 3: Redis Streams & Workers (Producer, consumer group, persistence worker, alert rules, heartbeat checks)
- [x] Phase 4: Real .NET Agent & Offline Buffer (WMI collectors, DPAPI encryption, SQLite offline queue, retry backoff, WiX MSI, enrollment gate `docs/AGENT_ENROLLMENT_AND_WMI_SPEC.md`)
- [x] Phase 5: Dashboard Integration (Remove preview fallbacks, connect UI to canonical Go API, secure realtime and exports)
- [x] Phase 6: Packaging, Deployment & CI/CD (Docker Compose full-stack `docker-compose.full.yml`, Kubernetes manifests `sentinelpulse-full.yaml`, GitHub Actions matrix CI workflow `ci.yml`)
- [x] Phase 7: Acceptance Validation (End-to-end acceptance test suite `server/acceptance.test.ts`, security scan report `docs/SECURITY_SCAN_REPORT.md`, compliance verification checklist)


## Local Windows Deployment — Active Follow-up
- [x] Fix `REDIS_URL` in local Compose configuration for the Go Redis client and revalidate `/health/ready`.
- [x] Start and validate the local frontend dashboard without disrupting existing Sophos containers.
- [x] Install .NET 8 and WiX v4 or use a verified MSI artifact for the Windows agent.
- [x] Confirm target endpoint and secure enrollment token before agent installation/enrollment.
- [x] Verify real WMI telemetry, endpoint commands, and audit persistence end to end.
- [x] Save a final checkpoint only after full local deployment validation.

Deployment findings: the target workspace is populated and SentinelPulse TimescaleDB, Redis, Go backend, and React/Nginx frontend containers are running under the Compose project `deployment`. `/health/live` and `/health/ready` return HTTP 200; the frontend returns the SentinelPulse dashboard at `http://localhost:3001`. Existing `sophos_platform` containers remain running and were not stopped. The frontend image was corrected to copy Vite output from `dist/public` instead of serving the stock Nginx welcome page. The local Windows host does not expose `dotnet` or `wix` on PATH, but the verified versioned 2.4.2 MSI artifact is present, its SHA-256 sidecar matches, and the installed service is Automatic and Running.
- [x] Fix Windows agent DPAPI scope enum compile error (`DataProtectionScope.Machine` must use the .NET-supported machine scope value) and rerun Release build; the active agent uses `DataProtectionScope.LocalMachine` and the verified 2.4.2 MSI is installed.
- [x] Update the MSI build script from WiX v3 `candle.exe`/`light.exe` calls to the installed WiX v4 `wix build` command, then produce and checksum a real MSI artifact; the 2.4.2 MSI and SHA-256 sidecar match.
- [x] Remove the agent's hardcoded placeholder token and hardcoded remote API URL; require explicit local API configuration and a real enrollment credential; the active client fails closed without `SENTINELPULSE_API_BASE_URL` and enrollment uses `SENTINELPULSE_ENROLLMENT_TOKEN`.
- [x] Correct agent enrollment payload/response handling to match the canonical Go backend (`endpoint_id`, `hostname`, and returned `device_token`).
- [x] Rebuild and upgrade the installed Windows service after the fail-closed agent configuration fix; `SentinelPulseAgent` is installed, Automatic, and Running.
- [x] Provide a Command-Prompt-safe elevated PowerShell execution path for the SentinelPulse agent MSI upgrade.
- [x] Verify local SentinelPulse backend readiness, Windows service execution, and agent MSI packaging.
- [x] Add a production Nginx frontend container to `deployment/docker-compose.yml` and a corresponding `frontend.Dockerfile` so the React dashboard runs in Docker alongside the Go backend.
- [x] Validate the new frontend Docker image by building it and proxying API traffic to the Go backend.
- [x] Repair Docker Compose frontend service definition and build context so `sentinelpulse_frontend` starts cleanly alongside the backend and database.
- [x] Prune stray ad-hoc containers and run `docker-compose -f deployment/docker-compose.yml up -d --build` to start `sentinelpulse_frontend` alongside the backend, database, and Redis.

## Deployment topology correction — 2026-08-14
- [x] Audit the existing Docker containers, Compose projects, labels, ports, and deployment files before making changes.
- [x] Confirm `deployment` is the intended Compose project and document that `sentinelpulse_frontend` is managed by it.
- [x] Keep the frontend in the existing `deployment` stack without creating a separate frontend stack or disturbing `sophos_platform`.
- [x] Ensure `docker-compose -f deployment/docker-compose.yml up -d` starts the frontend with the backend, database, and Redis.
- [x] Correct the frontend image output path so the dashboard replaces the stock Nginx welcome page.
- [x] Validate the final deployment topology, startup behavior, frontend reachability, and preservation of existing containers.
- [x] Save a checkpoint only after the topology correction and validation are complete.

The confirmed model is that `deployment` is the Docker Compose project name, not a single container. The canonical file is `deployment/docker-compose.yml`; it manages `postgres`, `redis`, `backend`, and `frontend`.

## Agent source canonicalization — 2026-08-14
- [x] Retire the legacy duplicate agent source tree/files that contain hardcoded API defaults or placeholder enrollment behavior; the local duplicate `agent/src/Communication` tree and unused `CompleteHardwareCollector.cs` were removed, and the MSI script targets the nested fail-closed project explicitly.
- [x] Verify the MSI build script and installed Windows service use only the fail-closed `agent/src/SentinelPulse.Agent` implementation; the service path is `C:\Program Files\SentinelPulse\Agent\SentinelPulse.Agent.exe` and it is Running/Automatic.

## Canonical repository agent cleanup — 2026-08-14
- [x] Remove or archive legacy duplicate agent files in the canonical repository, especially `agent/src/Communication/ApiClient.cs` with a hardcoded API default.
- [x] Rebuild or otherwise verify MSI provenance after canonical source cleanup and tie the installed service binary to the fail-closed nested project.

## Agent enrollment runtime validation — 2026-08-14
- [x] Generate or obtain a real tenant-scoped enrollment token for endpoint `DESKTOP-1E02MC9` and configure it as the machine environment variable `SENTINELPULSE_ENROLLMENT_TOKEN`.
- [x] Restart the agent, verify successful enrollment and encrypted device credential creation, and confirm real telemetry reaches the local backend/dashboard.

## First-Run Setup & Authentication Workflow — 2026-08-14
- [x] Implement a first-run setup wizard for initializing the platform (admin username, password hash, company/organization name, and local server IP/URL binding).
- [x] Provide username/password login supporting secure JWT cookie issuance and role-based permissions (Admin/Viewer).
- [x] Allow administrators to manage company settings, allowed local IPs, and generate tenant-scoped enrollment tokens for Windows endpoints.
- [x] Ensure agents configured with the local IP and enrollment token successfully authenticate against the canonical Go backend.

## Remaining integration & setup refinement gaps — 2026-08-14
- [x] Wire the backend REST handlers for `/api/v1/auth/setup` and `/api/v1/auth/login`.
- [x] Complete the agent-backend endpoint URL alignment (`/api/v1/agents/enroll` vs `/api/v1/agent/enroll`).

## Frontend setup-first routing bug — 2026-08-14
- [x] Wire `SetupPage` into the actual rendered `App.tsx` so first-run setup appears before the login page.
- [x] Rebuild only the existing `deployment` frontend service and verify `http://localhost:3001` displays the setup wizard.

## PostgreSQL SQL compatibility & runtime verification — 2026-08-14
- [x] Update `auth_handler.go` SQL statements to PostgreSQL syntax ($1, $2 placeholders, `ON CONFLICT` instead of `INSERT IGNORE`, `SERIAL` / `BIGSERIAL`).
- [x] Rebuild and restart the Go backend container, then verify setup status and login endpoints against TimescaleDB.

## Live backend container rebuild & integration verification — 2026-08-14
- [x] Rebuild and restart the deployment backend container (`docker-compose -f deployment/docker-compose.yml up -d --build backend`).
- [x] Verify live endpoints `/api/v1/auth/setup-status` and `/api/v1/auth/setup` using `curl` or `Invoke-WebRequest`.

## Live backend endpoint runtime verification gaps — 2026-08-14
- [x] Correctly copy updated Go source files into the connected Windows workspace build tree.
- [x] Rebuild and verify live `/api/v1/auth/setup-status` returns `HTTP 200` without 404.

## Workspace backend sync & live verification checklist — 2026-08-14
- [x] Confirm updated server.go and auth_handler.go exist inside the Windows workspace backend tree; both files are present in `Aaditech_Monitoring_Platform/backend/go` and the rebuilt backend serves the new route.
- [x] Verify live `/api/v1/auth/setup-status` returns HTTP 200 from the container; direct and frontend-proxied requests return `{"setup_complete":false}`.

## Frontend API proxy failure — 2026-08-14
- [x] Add Nginx reverse proxying in the existing `deployment` frontend for the supported Go REST API paths under `/api/v1/`; `/api/v1/auth/setup-status` and `/api/v1/auth/setup` now proxy successfully. Local Go mode intentionally does not depend on tRPC.
- [x] Rebuild only `sentinelpulse_frontend` and verify setup-status returns 200 and setup POST returns the backend validation response rather than 404 from port 3001.

## Local Go backend and tRPC compatibility — 2026-08-14
- [x] Prevent the OAuth/tRPC client from issuing unsupported `/api/trpc/auth.me` requests during local username/password setup by disabling the OAuth auth query in the local Go-backed App runtime.

## Local dashboard REST/runtime compatibility — 2026-08-14
- [x] Stop token generation and refresh actions from calling unsupported `/api/trpc/monitoring.*` endpoints in the local Go-backed Docker runtime; token generation now uses `/api/v1/enrollment-tokens`, and refresh commands use the Go endpoint-command REST route.
- [x] Replace or disable the unsupported `/api/realtime/stream` connection in local Go mode so it does not produce 404s; SSE is now disabled when `VITE_LOCAL_GO_API` is not explicitly `false`.
- [x] Rebuild the existing `deployment` frontend and verify the affected local REST routes remain healthy after the change; the frontend rebuild completed successfully and `setup-status` continues to return HTTP 200 through port 3001.

## Test validation follow-up — 2026-08-14
- [x] Isolate and document the `server/monitoring.test.ts` dashboard-summary timeout without regressing the local REST compatibility fixes; the first run had one 5-second timeout, and a targeted rerun completed all 4 monitoring tests successfully in 3.59 seconds. The earlier root cause remains unconfirmed, so no stronger cause is asserted.

## Token page browser compatibility — 2026-08-14
- [x] Replace `crypto.randomUUID()` in the token-generation UI with a crypto-free timestamp/random client identifier so older or restricted browsers do not crash after token creation; the OAuth nonce path also has a guarded fallback.
- [x] Rebuild the existing `deployment` frontend and verify the rebuilt container serves HTTP 200 with setup-status HTTP 200; direct source/bundle inspection confirms the token-row code no longer calls `crypto.randomUUID`. The connected Windows browser must still perform the final hard-refresh-and-click check because the sandbox browser cannot reach the Windows host network.

## Automatic signed MSI build workflow — 2026-08-14
- [x] Add a secure Windows build/signing contract that separates certificate metadata from the private signing key and never exposes the key in the dashboard or MSI.
- [x] Extend the local platform with an administrator-only MSI build job that compiles the agent, signs the agent executable and MSI when a trusted certificate is configured, creates a SHA-256 sidecar, and records build status.
- [x] Add certificate status/configuration UI and a versioned MSI build/download action to the post-setup dashboard.
- [x] Add backend/API validation and unit test coverage for certificate status, admin authorization, build-job validation, and artifact download metadata.
- [x] Validate the signed/unsigned paths on the connected Windows workspace, including Authenticode verification, service-install compatibility, and Docker frontend integration.
- [x] Document that production signing requires a user-provided trusted code-signing certificate/private key or approved signing service; do not generate a fake trusted certificate automatically.
- [x] Mark this workflow complete only after the local build/install smoke test passes and save a checkpoint.

## Automatic signed MSI workflow — security design notes
- [x] Define the safe default: automatic signing can only use a certificate/private key already provisioned by the administrator; the platform must not mint a trusted public certificate or expose a PFX/private key through the browser.
- [x] Define the test-only alternative: an explicitly labeled self-signed certificate may be generated for internal testing, but it must be marked untrusted and never presented as production signing.
- [x] Define versioning: each build receives an explicit semantic version, immutable artifact filename, checksum, signing status, certificate subject/thumbprint, and build timestamp.
- [x] Define deployment boundary: the actual `dotnet publish`, WiX build, Authenticode signing, and artifact storage run on the connected Windows build host, not inside the Linux Docker frontend container.
- [x] Define authorization: only platform Admin users can configure signing, start builds, or download MSI artifacts; Viewer users remain read-only.
- [x] Define failure behavior: if no trusted certificate is configured, the production build action fails closed with an actionable message; an unsigned test MSI is allowed only through an explicit test-mode action.

## Automatic signed MSI workflow — implementation history
- [x] Inspect canonical backend, dashboard, and Windows workspace structure before editing.
- [x] Implement the Windows build/sign script and manifest/report output.
- [x] Implement backend endpoints and persistence for signing/build status.
- [x] Implement dashboard controls and download flow.
- [x] Run tests and local Windows smoke validation.
- [x] Save final checkpoint after all items above are complete.


## Manual Builder Key & MSI Download Repair — 2026-08-14
- [x] Investigate why the MSI download option was missing in the dashboard (verify API client mappings, job status rendering, and admin permissions).
- [x] Implement manual builder key configuration instructions so operators can set `MSI_BUILDER_KEY` directly in `deployment/.env`.
- [x] Ensure canonical workspace files match the connected Windows workspace MSI build/download UI and API code.
- [x] Rebuild and restart the container stack, then verify that the download action appears for completed builds.

## RS256 JWT & PFX Signing Certificate Configuration — 2026-08-14
- [x] Add support for `JWT_PRIVATE_KEY_RS256`, `JWT_PUBLIC_KEY_RS256`, `SIGNING_CERT_PFX_PATH`, and `SIGNING_CERT_PASSWORD` in backend config and Docker Compose.
- [x] Configure the Windows runner and build script to accept PFX-based signing certificates securely.
- [x] Validate fail-closed behavior when required PFX paths or RS256 keys are missing in production signing mode.
- [x] Document manual key and certificate placement in `deployment/.env`.
- [x] Preserve `SIGNING_CERT_PFX_PATH=/run/secrets/signing_cert.pfx` exactly as requested and validate the certificate is mounted or translated into a path accessible by the Windows signing runner; fail closed if it is not accessible.


## Screenshot MSI Download Visibility Repair — 2026-08-14
- [x] Redesign the EnrollmentTokens MSI card so a clear download/status box is always rendered even when the runner is offline or no jobs have been queued yet.
- [x] Provide a direct fallback or manual installer instruction when the runner is offline so the operator is never left with a blank "No MSI builds have been queued" message.
- [x] Rebuild and restart the container stack and verify the updated download guidance appears immediately in the live UI; frontend and backend returned HTTP 200, containers are running, and the production bundle contains the new download control.

## Agent Telemetry & MSI Signature Verification — 2026-08-14
- [x] Investigate why installed agent telemetry is not reaching the portal (check enrollment token configuration, API base URL registry, DPAPI configuration, and Windows Service logs).
- [x] Add Authenticode signature inspection to the MSI build manifest and dashboard so operators can instantly verify whether an installer is signed and check its certificate subject/thumbprint.
- [x] Provide clear PowerShell diagnostic commands for checking the installed SentinelPulse agent status and service logs on the Windows host.

## PowerShell Path Bug Fix — 2026-08-14
- [x] Fix `$MyInvocation.MyCommand.Definition` null pointer in `generate-builder-key.ps1` and `run-msi-builder.ps1` by falling back to `$PSScriptRoot`.
- [x] Ensure the script reliably writes `MSI_BUILDER_KEY` to `deployment/.env` and `agent/config/msi-builder.key`.
- [x] Re-run the key generation script and runner startup on the Windows host and verify runner online status.

## Parameter Default Root Resolution Fix — 2026-08-14
- [x] Move ProjectRoot resolution out of parameter defaults into the script body so `$PSScriptRoot` resolves correctly.
- [x] Test key generation on the Windows host and verify `deployment/.env` is written successfully.

## PowerShell 5.1 Crypto Compatibility Fix — 2026-08-14
- [x] Replace `[System.Security.Cryptography.RandomNumberGenerator]::Fill()` with PowerShell 5.1 compatible `.GetBytes()` in `generate-builder-key.ps1`.
- [x] Execute key generation directly on the connected Windows desktop session via the shell tool.
- [x] Start the runner in the background on the Windows desktop session and verify backend status reporting.

## Persistent Runner & Online Status Improvements — 2026-08-14
- [x] Extend backend runner online timeout window from 2 minutes to 5 minutes so background polling does not flicker offline.
- [x] Run the Windows runner in continuous background polling mode without `-Once`.
- [x] Queue a test build in the dashboard, verify the runner picks it up, compiles, signs with self-signed test mode, and generates a downloadable artifact.

## Local Windows Deployment & Runner Repair — 2026-08-14
- [x] Inspect local Windows desktop state: verified `deployment/.env`, `MSI_BUILDER_KEY`, backend container logs, and runner script errors.
- [x] Start the local Windows runner in continuous polling mode (`run-msi-builder.ps1`) directly on the connected host.
- [x] Confirm the pending job transitions to `succeeded`, generates the signed MSI, and makes download/telemetry fully operational on `http://10.73.99.58:3001`.

## MSI runner stuck-job repair — 2026-08-14
- [x] Audit the connected Windows host runner, Visual Studio signing tools, environment variables, and current pending/running MSI jobs.
- [x] Fix runner/build error propagation and retry/claim behavior so jobs cannot remain indefinitely pending or running after a failed build/sign step.
- [x] Validate a real signed MSI build using the available Visual Studio Windows SDK signing tools, then verify portal download, signature status, and endpoint telemetry.
- [x] Verify the authenticated latest-MSI download in the connected Windows browser after refreshing the `/tokens` page.
- [x] Configure the installed agent with a tenant-scoped enrollment token, restart the service, and verify endpoint plus real WMI metrics appear in the local database/dashboard.
- [x] Add and validate a Command-Prompt-safe enrollment helper so operators can set the token without accidentally entering PowerShell commands into cmd.exe; PowerShell 5.1 help parsing passed without writing a token.
- [x] Update the acceptance test that still expects the removed local tRPC MSI build mutation; it now asserts the documented `PRECONDITION_FAILED` contract.
- [x] Add a `.cmd` wrapper that launches the enrollment PowerShell helper safely from Command Prompt with the local API default; wrapper text validation confirms RunAs elevation and helper wiring without executing or exposing a token.
- [x] Fix the agent telemetry URL to match the live Go route `/api/v1/telemetry` instead of `/api/v1/telemetry/ingest`, rebuild the MSI, reinstall/upgrade the service, and verify WMI metrics reach TimescaleDB.
- [x] Add and validate an elevation-safe 2.4.3 MSI upgrade wrapper because the connected shell is not Administrator and Windows Service Control Manager returned Access Denied.
- [x] Validate enrollment-token format in the helper (`sp-enrol-<UUID>`) so an MSI builder key or unrelated 64-character secret cannot be written as an agent enrollment token.
- [x] Align the frontend token generation client (`App.tsx`) with the backend Go endpoint (`/api/v1/enrollment-tokens`) so generated tokens correctly return `sp-enrol-<UUID>` instead of client-side random strings.
- [x] Correct example script token format in `EndpointsList.tsx` from old random string to `sp-enrol-00000000-0000-0000-0000-000000000000`.
- [x] Validate backend enrollment token creation (`CreateToken`) issues `sp-enrol-<UUID>` strings matching the agent and helper expectations.

## Windows Docker rebuild and live verification — 2026-08-15
- [x] Inspect the actual Windows Docker Compose project, compose command, running containers, source mounts, and current service health; Docker Compose v5.3.1 and the `deployment` project were confirmed.
- [x] Rebuild and force-recreate the Docker frontend and backend from the synchronized source; both containers are running, `/api/v1/auth/setup-status` returns 200, and the rebuilt frontend bundle contains the corrected `sp-enrol-` marker.
- [x] Test the live portal token generation format, authenticated MSI download, runner status, and agent enrollment/WMI telemetry only after the rebuild.

## One-Time Automatic Agent Enrollment & Portal Token Fix — 2026-08-15
- [x] Align the backend enrollment token generator (`enrollment.go`) to issue standard UUID-formatted tokens (`sp-enrol-<UUID>`) matching database and helper expectations.
- [x] Embed automated enrollment bootstrap in the Windows MSI installer and service startup so agents register automatically upon installation without manual token prompts.
- [x] Rebuild Docker backend/frontend and compile MSI 2.4.4; verify one-time install and live telemetry end to end.

## One-Time Automatic Enrollment — 2026-08-15
- [x] Normalize every enrollment token producer to `sp-enrol-<UUID>` and add regression coverage against compact hex tokens.
- [x] Extend the MSI build queue contract with tenant-scoped, single-use bootstrap settings without exposing plaintext credentials in admin build history.
- [x] Forward bootstrap settings through the Windows runner and WiX MSI, then clear the enrollment token after successful agent enrollment.
- [x] Replace the dashboard's separate copy-token/build workflow with a one-time automatic build form using API URL and endpoint identity.
- [x] Rebuild the Docker stack and compile a versioned v2.4.4 MSI on the connected Windows host.
- [x] Validate one-time installation, service enrollment, real WMI telemetry ingestion, tenant isolation, and signed artifact metadata.

## MSI Build Queue & Version Fixes
- [x] Diagnose msi_build_jobs table insertion failure and runner polling loop
- [x] Ensure versioned MSI artifacts match exact build job versions and DownloadLatest serves newest job artifact
- [x] Rebuild Docker backend container and verify build queueing and completion end-to-end

## Secure Diagnostic Audit Trail
- [x] Create database migration for tenant-isolated diagnostic audit events table
- [x] Implement backend API endpoints and Go logging middleware for recording structured steps
- [x] Add agent and runner diagnostic reporting for build, installation, enrollment, and telemetry push
- [x] Build a dedicated Diagnostics & Audit Trail tab in the React dashboard with live filtering

## Same-laptop endpoint telemetry diagnosis — 2026-08-15
- [x] Read-only inspect the connected Windows laptop's SentinelPulse service state, service command line, registry/environment configuration, and agent logs.
- [x] Read-only inspect the connected laptop's Docker Compose containers, backend/frontend health, backend logs, enrollment responses, and telemetry database rows.
- [x] Correlate endpoint and backend evidence to identify the exact enrollment, network binding, authentication, or ingestion failure.
- [x] Apply only explicitly approved code/configuration/runtime fixes, then rebuild/restart only the affected local components.
- [x] Validate same-laptop enrollment and real WMI telemetry end to end, including dashboard visibility and diagnostic audit events.
- [x] Document the root cause, evidence, commands, validation results, and rollback point.

## Historical diagnostic items retained from previous sessions
- [x] Prior telemetry validation was recorded as complete, but the current same-laptop report requires fresh read-only evidence rather than relying on the prior checkpoint.
- [x] No destructive database operation is authorized as part of this diagnostic pass.

## Same-Laptop Telemetry Fix & Validation Plan — 2026-08-15
- [x] Save a pre-fix checkpoint as the rollback reference.
- [x] Verify Docker container health (`sentinelpulse_backend`, `sentinelpulse_db`, `sentinelpulse_redis`, `sentinelpulse_frontend`).
- [x] Issue a valid tenant-scoped enrollment token via the backend database / API helper or portal token generator.
- [x] Apply the valid canonical `sp-enrol-<UUID>` token to the local Windows agent environment and registry using `configure-agent-enrollment.ps1`.
- [x] Restart the `SentinelPulseAgent` Windows service and verify successful enrollment, credential persistence via DPAPI, and token cleanup.
- [x] Query TimescaleDB `endpoints`, `endpoint_credentials`, and `endpoint_metrics_hyper` to confirm real WMI telemetry ingestion.
- [x] Verify live dashboard visibility for `DESKTOP-1E02MC9` and diagnostic audit log recording.
- [x] Save a final checkpoint upon successful validation.

## MSI Builder & Runner Diagnosis Plan — 2026-08-15
- [x] Inspect backend router implementation for `/api/v1/admin/msi-builds` and related builder status routes.
- [x] Check backend Docker container logs for incoming MSI builder status or queue requests yielding 404/500 errors.
- [x] Inspect Windows runner script (`run-msi-builder.ps1`) and signing logic for exit code 1 failures.
- [x] Verify database schema and columns for `msi_build_jobs` and `msi_builder_status`.
- [x] Fix any route binding or runner signing/polling bugs and verify status endpoint returns 200 OK.
- [x] Trigger a fresh v2.4.5 MSI build from the portal and verify successful queueing, runner claim, compilation, signing, and download availability.

## Cloud vs Local Config Comparison Plan — 2026-08-15
- [x] Inspect git status and commit history in sandbox workspace.
- [x] Inspect git status and commit history in mounted remote Windows workspace (`/mnt/desktop/Aaditech_Monitoring_Platform`).
- [x] Compare backend/frontend configuration, environment variables, and Docker Compose files across both environments.
- [x] Provide a transparent, accurate comparison summary explaining whether local and cloud configs are synchronized.

## MSI Gap Audit & Root Cause Plan — 2026-08-15
- [x] Audit frontend build request parameters (`agent_version`, `sign_mode`, `api_base_url`, `endpoint_id`, `automatic_enrollment`) against backend `msiBuildRequest`.
- [x] Audit backend queueing table schema (`msi_build_jobs`) and tenant organization ID mapping during `createBuild`.
- [x] Audit Windows runner polling logic (`run-msi-builder.ps1`) for API authentication headers and header mismatch (`X-MSI-Builder-Key` vs `Authorization`).
- [x] Audit WiX v4 packaging prerequisites, .NET 8 SDK / MSBuild path resolution, and signing certificate provisioning on the Windows host.
- [x] Compile a definitive gap matrix with exact error points and required remediation steps.

## Post-Compile JSON Configuration Propagation Plan — 2026-08-15
- [x] Inspect WiX source file (`sentinelpulse-agent.wxs`) for config file generation and custom actions or registry property mappings.
- [x] Inspect `build-msi.ps1` to see how bootstrap API base URL, endpoint ID, and enrollment token are written into the compiled MSI or post-install config JSON.
- [x] Inspect agent C# source (`AgentConfiguration.cs` or `Program.cs`) to check where config JSON or registry settings are read at startup.
- [x] Fix any gap where generated JSON configuration files lack bootstrap or endpoint metadata after compilation.
- [x] Rebuild and verify that a newly generated MSI correctly writes the runtime JSON config with all required endpoint information.
