# SentinelPulse Honest Implementation Roadmap

## 1. Acceptance Criteria & Preflight Validation
- [x] Define explicit, testable acceptance criteria for universal MSI packaging, dynamic config, two-phase enrollment, and WMI telemetry streaming.
- [x] Add preflight validation script for backend, database, and local runner health.

## 2. Configuration & Enrollment Precedence Fixes
- [x] Align `AgentConfiguration.cs` precedence with design: authoritative JSON `config.json` -> Environment Variables -> Registry fallback.
- [ ] Add unit tests for configuration resolution hierarchy and token hashing.

## 3. Universal MSI & Dynamic Config Generation
- [x] Update WiX template (`sentinelpulse-agent.wxs`) and `build-msi.ps1` to support public MSI properties (`API_BASE_URL`, `ENROLLMENT_TOKEN`) and automatically write `config.json` to `ProgramData\SentinelPulse\Agent\config.json`.
- [x] Verify installer generation without failing clean developer environments.

## 4. Backend Enrollment & Telemetry Ingestion Hardening
- [ ] Validate `/api/v1/enroll` credential exchange end-to-end with the local Windows agent.
- [ ] Verify WMI telemetry ingestion pipeline and record diagnostic audit events for enrollment and metrics push.

## 5. End-to-End Acceptance Test & Verification
- [ ] Compile version 2.4.5 MSI installer through portal/runner.
- [ ] Install MSI on local Windows endpoint, verify zero-prompt automatic enrollment and device credential persistence via DPAPI.
- [ ] Confirm real WMI telemetry appears in the PostgreSQL/TimescaleDB tables and React dashboard overview.

- [x] Complete evidence-based end-to-end audit and save the consolidated gap report in SENTINELPULSE_COMPLETE_AUDIT.md.

- [ ] Reconcile the local portal showing 0 endpoints with backend/database evidence showing DESKTOP-1E02MC9 and fresh telemetry; verify the exact API response, tenant filter, and frontend mapping before claiming UI success.

## New private GitHub repository publication — 2026-08-25

- [x] Inspect current Git remotes, branch, working tree, and untracked files before repository creation.
- [x] Verify secrets, certificates, tokens, local environment files, logs, build artifacts, and generated files are excluded from the new repository.
- [x] Create a new private GitHub repository for the SentinelPulse project.
- [x] Commit the safe project state on the main branch.
- [x] Push main to the new private repository and verify the remote tree and commit.

## Approved gap-closure implementation — 2026-08-25

- [x] Baseline and test the current RAM/GPU backend-to-UI contracts before changing mappings.
- [ ] Correct RAM module speed, slot count, and form-factor propagation and rendering from real evidence.
- [ ] Replace the single GPU VRAM summary with truthful per-adapter dedicated/shared/unavailable presentation.
- [ ] Align dashboard collector coverage and health claims with actual evidence and timestamps.
- [ ] Complete SFC/driver/SMART diagnostic evidence and freshness presentation.
- [ ] Complete process, software, and event evidence fields and freshness indicators.
- [ ] Implement alert rule evaluation, tenant scoping, acknowledgement, suppression, and maintenance semantics.
- [ ] Implement tenant-scoped Department/Location catalogs, dropdowns, Tags behavior, and metadata audit trail.
- [ ] Harden MSI/enrollment build, signing, URL/token configuration, artifact verification, and zero-manual workflow.
- [ ] Repair and verify JSON/CSV/PDF exports and live-stream freshness/reconnect behavior.
- [ ] Run end-to-end regression acceptance tests and publish only verified changes.

- [x] Add dashboard-level collector freshness timestamps for telemetry, diagnostics, and last successful evidence capture.
- [ ] Replace dashboard status derivation with explicit backend evidence fields rather than only inferred local fields.
- [x] Add tests covering timestamped dashboard degraded/limited states and truthful label rendering.

- [x] Add DashboardOverview component tests for explicit-evidence, degraded, and no-evidence status labels.
- [x] Add DashboardOverview tests for timestamped freshness text and the no-timestamp fallback.

- [x] Add a healthy explicit-evidence DashboardOverview test asserting the TELEMETRY STATUS OBSERVED label.
- [x] Strengthen the timestamped DashboardOverview test to assert the rendered freshness value for a supplied capturedAt timestamp.

- [x] Extend preflight with a real database readiness/connectivity check instead of only checking DATABASE_URL presence.
- [x] Add an actual MSI/local runner health probe through a configured status endpoint or heartbeat.
- [x] Add regression tests for healthy, unhealthy, and misconfigured preflight backend/database/runner scenarios.

- [x] Include scripts/**/*.test.ts in the Vitest patterns so preflight regression tests execute in pnpm test.
- [x] Re-run pnpm test and verify the preflight healthy, unhealthy, and misconfigured scenarios pass.

- [x] Remove mock-admin-token fallback from Platform Settings and use the authenticated session credential or fail closed.

- [x] Add frontend API tests proving null or object endpoint responses fail with a descriptive payload error instead of crashing on map.

- [x] Assert the descriptive INVALID_API_PAYLOAD error message text for both null and object endpoint responses.

- [x] Align preflight health probes with the canonical Go routes /health/live and /health/ready, and assert the exact paths in regression tests.

- [x] Remove synthetic CPU/RAM/disk values and hardcoded org-tenant-default attribution from telemetry persistence.
- [x] Propagate authenticated endpoint tenant identity through Redis telemetry messages and enforce endpoint/token tenant isolation.
- [x] Add backend tests proving unauthenticated, revoked, mismatched-endpoint, and cross-tenant telemetry writes are rejected.

## Approved truthful telemetry and tenant isolation — 2026-08-25

- [x] Add a non-destructive migration making persisted metric columns nullable so unavailable WMI evidence is stored as NULL rather than fabricated values.
- [x] Propagate authenticated tenant identity through the telemetry envelope and Redis stream.
- [x] Require valid device bearer credentials for telemetry ingestion and reject revoked or unknown credentials.
- [x] Reject telemetry when the envelope endpoint ID does not match the authenticated device credential.
- [x] Persist real CPU, RAM, and disk values from the telemetry payload, preserving missing values as NULL.
- [x] Remove fabricated CPU, RAM, disk, and temperature fallbacks from the Windows agent collector.
- [x] Add backend tests for telemetry authentication, endpoint matching, tenant isolation, and real metric persistence.
- [x] Run full frontend, Go backend, and available Windows-agent validation; document any unavailable platform-specific validation.

- [x] Add a Go regression test proving a valid device credential cannot persist telemetry for an endpoint or tenant outside its authenticated tenant scope.

- [x] Add an end-to-end Go test authenticating a valid device bearer token and proving wrong-endpoint telemetry is rejected before persistence.
- [x] Add an integration-style test covering device-auth middleware, ingress queue, and worker for a tenant-scoped credential attempting to affect another tenant endpoint.

- [x] Add one Go integration-style telemetry test that authenticates a valid device bearer token, submits through HTTP ingress, confirms Redis queue behavior, runs worker processing, and proves cross-tenant endpoint access is rejected.

- [x] Fix the Windows agent compile failure where Worker.cs references SystemMetrics.Diagnostics but the current model does not define that member.
- [x] Rebuild the Windows agent with --no-restore after reconciling the diagnostics model and worker payload contract.

- [ ] Resolve the bound Windows NuGet ConfigurationDefaults null-profile restore error so the new AgentConfiguration xUnit project can execute.

- [x] Verify the locally generated SentinelPulseAgent-2.4.17 MSI manifest, SHA-256, embedded runtime config, and unsigned-test signature status without installing it.

- [x] Inspect and record WiX evidence for API_BASE_URL, ENROLLMENT_TOKEN, and the ProgramData config target before finalizing packaging status.
- [ ] Validate or explicitly document MSI generation behavior under a clean Windows profile rather than treating one cached build as clean-environment proof.
- [x] Inspect MSI tables/content to prove the generated runtime config is included in the package, then re-verify checksum and signature metadata.

- [x] Fix WiX WIX0006 when public MSI properties are omitted by declaring optional properties without empty Value attributes.

- [x] Re-verify the 2.4.18 MSI manifest, SHA-256 checksum, and Authenticode status after decompiling it to prove the embedded runtime config is present in that same artifact.

- [x] Run a standalone successful `Get-AuthenticodeSignature` check for `SentinelPulseAgent-2.4.18-x64.msi` after decompilation and record the `NotSigned`/signature status for that same artifact before marking the todo complete.

- [x] Enrich the authenticated monitoring.endpoints payload with tenant-scoped metadata, latest battery evidence, latest network adapters, and application-usage records instead of requiring disconnected detail calls.

- [x] Pass the authenticated organization identity from the monitoring router context into endpoint selection and enrichment instead of relying on the hardcoded default organization.
- [x] Enforce endpoint ownership on metadata, battery, network, and application-usage enrichment queries and add a cross-tenant regression test for the enriched payload.

- [x] Add focused monitoring tests proving metadata, battery, network, and application-usage evidence for an endpoint is unavailable when the authenticated organization does not own that endpoint.

- [x] Synchronize the repository-defined metadata and optional telemetry tables into the connected database with additive SQL and verify their presence and row counts without inserting data.

- [x] Remove the fabricated dashboard diskCriticalCount value and report zero or an evidence-derived count until disk-health evidence is actually persisted.

- [x] Add authenticated tenant-scoped Department and Location catalog list/create procedures, additive tables, and an admin-gated Settings UI with truthful empty states.

- [x] Enforce authenticated organization ownership on endpoint metadata writes and validate the secured mutation with TypeScript and monitoring tests.

- [x] Add endpoint-detail Department and Location dropdowns plus admin-gated owner, immutable Asset ID, tags, and maintenance-mode metadata controls backed by the tenant-scoped mutation.

- [x] Make Asset ID server-generated on first metadata write and immutable thereafter; ignore client-supplied asset IDs and add regression coverage.

- [x] Render optional RAM physical slot occupancy in the dashboard and retain explicit unavailable labels when the agent does not provide slot evidence.

- [x] Suppress listed system alerts for endpoints in maintenance mode and scope alert acknowledgement and rule enablement updates to the authenticated organization.

- [x] Replace the fleet JSON export placeholder with a real client download of the currently authenticated, tenant-scoped endpoint payload.

- [x] Remove the report export N-plus-one telemetry query path and use one tenant-scoped enriched endpoint read so CSV/PDF generation does not appear to hang on larger fleets.

- [x] Remove synthetic T-minus timestamps and zero-valued CPU/RAM trend points; show an explicit no-evidence state when no performance samples exist.

- [x] Compute true fleet-wide CPU/RAM averages per real timestamp bucket and keep chart labels aligned with that aggregation.
- [x] Add DashboardOverview regression coverage for the no-performance-evidence empty state and fleet-average chart semantics.

- [x] Add an additive tenant-scoped endpoint metadata audit table and record actor, endpoint, changed fields, and timestamp on every admin metadata mutation.

- [x] Use the existing WMI process-owner lookup in process diagnostics and report unavailable when Windows denies access instead of always emitting Unknown.

- [x] Compute a true last-successful evidence timestamp separately from latest capture and add success-versus-limitation regression coverage.
- [x] Normalize diagnostics collector evidence into a real dashboard diagnostics freshness key and test that it renders from supplied evidence.

- [x] Remove frontend normalization fallbacks that fabricate endpoint timestamps or status evidence; preserve explicit backend values and use unavailable labels for missing fields.

- [x] Audit every endpoint normalization fallback and distinguish evidence-safe unavailable labels from real backend values.
- [x] Add normalization tests for missing timestamps/identity fields and pending, disabled, online, warning, and offline statuses.
- [x] Document contract-safe normalization behavior so future endpoint mapping cannot reintroduce fabricated evidence.

- [x] Audit remaining hardware, OS-health, array, and unknown-value endpoint defaults; ensure they are explicit unavailable states rather than fabricated evidence.
- [x] Add regression assertions for missing hardware and OS-health payloads so numeric values are never presented as observed.
- [x] Expand the endpoint normalization contract documentation to cover status mapping, timestamps, identity, hardware, OS health, arrays, and unavailable placeholders.

- [x] Add DashboardOverview and endpoint-detail regression tests proving missing hardware and OS-health payloads render unavailable rather than zero or healthy evidence.
- [x] Add regression coverage for empty disk, software, process, and event collections so no fabricated rows appear.

- [x] Fix EndpointDetail JSX runtime import so the new unavailable-evidence regression renders under the configured React transform.

- [x] Fix ExtendedTelemetryPanel JSX runtime import so EndpointDetail unavailable-evidence rendering can complete under Vitest.

- [x] Add an isolated ResizeObserver stub to the EndpointDetail jsdom test so Recharts does not obscure the evidence assertions.

- [ ] Extend the Windows agent telemetry payload with truthful WMI-backed RAM module speed/slot/form-factor and per-adapter GPU dedicated/shared-memory evidence.

- [x] Extend the Windows agent telemetry payload with truthful WMI-backed RAM module speed/slot/form-factor and per-adapter GPU dedicated/shared-memory evidence; bound Release build passes with zero warnings/errors.

- [x] Reconcile the local Windows service artifact with the current agent build; MSI 2.4.36 installed with executable version 2.4.36.0 and service Running/Automatic.

- [x] Set the Windows agent assembly/file/product version from the same release version used by MSI generation and add a parity check; observed 2.4.36.0/2.4.36 metadata matches the MSI release.

- [x] Wire AgentSemVer into .NET publish metadata and verify a bound Windows publish produces FileVersion/ProductVersion 2.4.18.0/2.4.18 instead of 1.0.0.

- [x] Build and verify MSI 2.4.19 with preserved enrollment configuration; manifest SHA-256 equals the actual artifact hash and expected unsigned-test Authenticode status is NotSigned.

- [x] Install MSI 2.4.19 on the bound Windows machine; service is Running/Automatic, executable metadata is FileVersion 2.4.19.0 and ProductVersion 2.4.19, and MSI event 11707 confirms successful installation.
- [x] Complete post-install telemetry evidence: replay-enabled MSI 2.4.20 is installed with FileVersion/ProductVersion 2.4.20.0/2.4.20, service is Running/Automatic, encrypted credential file is present, and PostgreSQL metrics increased from 5928 to 5950 during a 45-second polling window.

## Migration completion execution — 2026-08-25

- [ ] Trace the installed Windows agent enrollment and telemetry request path against the running backend, including actual response codes and observed offline-buffer behavior.
- [ ] Add or repair agent-visible structured diagnostics for enrollment, collection, queueing, and telemetry delivery without recording secrets, then verify those diagnostics from the running installed build.
- [ ] Verify real WMI RAM/GPU/battery/network evidence from a clean collection cycle reaches tenant-scoped database rows and dashboard fields; the newest accepted payload now includes non-null CPU/RAM/disk values plus memory_modules, graphics_adapters, and diagnostics keys, but dashboard and battery/network field verification remain open.
- [ ] Complete remaining diagnostic freshness and evidence-safe UI gaps for SFC, SMART, drivers, processes, software, and event records.
- [ ] Verify live JSON/CSV/PDF exports and telemetry freshness/reconnect behavior against authenticated tenant data.
- [ ] Resolve or explicitly document the Windows NuGet ConfigurationDefaults restore blocker and execute the available Windows unit tests.
- [ ] Validate clean-profile MSI generation, version/hash parity, enrollment configuration, and production signing gate.
- [ ] Run final frontend, backend, packaging, and end-to-end acceptance tests; update the migration decision only from observed evidence.

- [ ] Resolve MSI 2.4.22 installation failure caused by Windows Application Control blocking the unsigned executable; production validation requires a trusted Code Signing certificate or an explicitly approved local test-policy exception.
- [x] Confirm accepted telemetry after the replay-enabled 2.4.20 build: PostgreSQL metrics increased from 5928 to 5950 during a 45-second polling window, and the durable agent log recorded buffered replay plus successful collector completion.

## Simple MSI release flow

- [x] Make the primary release action explicitly named **Compile MSI** and keep the flow focused on generating a versioned MSI directly from the platform; UI label verified with the complete 40-test suite.
- [x] Provide the generated MSI as the primary download, with SHA-256 manifest and optional helper/verification artifacts grouped as secondary downloads; MSI and `.sha256` manifest are tenant-scoped and the manifest is a secondary action beside succeeded builds.
- [x] Ensure release status clearly distinguishes queued, building, succeeded, failed, unsigned test, and trusted-signed states without exposing signing secrets; labels are explicit and covered by regression tests.
- [x] Add regression coverage for the simplified MSI release UI and verify production build/checkpoint; status-label contract is covered and checkpointed with TypeScript plus 47 passing tests.

- [ ] Add explicit backend/UI lifecycle states `ENROLLMENT_FAILED`, `AUTH_ERROR`, and `DISABLED` with truthful reason and timestamp fields; preserve tenant isolation and avoid treating failed enrollment/auth as offline or online.

- [x] Diagnose and fix post-setup login rejection when the same setup username/password redirects to `/login`; preserve browser state, verify setup persistence, and add regression coverage for the setup-to-login contract. Preview-vs-local runtime mismatch is documented; exact setup email persistence is covered by a passing regression test, and local Docker login/session was verified live.
- [x] Capture login failure evidence: confirmed from browser network logs that POST `/api/v1/auth/login` on the `3000-...manus.computer` Preview URL returns HTTP 200 with the 368 KB SPA HTML, not an authentication JSON response; the preview is not connected to the local Docker/Go auth runtime.
- [x] Verify the authenticated local Docker path after the Preview failure: `http://localhost:3001/login` accepted the setup account and opened `/endpoints/DESKTOP-1E02MC9` for `aziz.shaikh` as ADMIN; live endpoint data is visible, and automated setup-to-login regression coverage now passes.

- [x] Render `pending`, `enrollment_failed`, `auth_error`, and `disabled` with distinct evidence-safe endpoint status labels and colors; endpoint-detail regression coverage passes.

- [x] Refresh SENTINELPULSE_P0_ACCEPTANCE_STATUS.md with the latest 51 frontend/server tests, authentication/configuration coverage, MSI manifest/status coverage, and tenant-bound enrollment failure semantics.

- [x] Add and verify an automated Windows parity check that reads the MSI release version from its filename, reads installed EXE FileVersion/ProductVersion, rejects 1.0.0 or mismatches, and records a successful 2.4.36 result; connected endpoint returned `Result: PASS`, FileVersion `2.4.36.0`, ProductVersion `2.4.36`.

- [x] Add the automated 2.4.36 MSI/EXE parity PASS result to SENTINELPULSE_P0_ACCEPTANCE_STATUS.md.
