# SentinelPulse Honest Implementation Roadmap

## 1. Acceptance Criteria & Preflight Validation
- [ ] Define explicit, testable acceptance criteria for universal MSI packaging, dynamic config, two-phase enrollment, and WMI telemetry streaming.
- [ ] Add preflight validation script for backend, database, and local runner health.

## 2. Configuration & Enrollment Precedence Fixes
- [ ] Align `AgentConfiguration.cs` precedence with design: authoritative JSON `config.json` -> Environment Variables -> Registry fallback.
- [ ] Add unit tests for configuration resolution hierarchy and token hashing.

## 3. Universal MSI & Dynamic Config Generation
- [ ] Update WiX template (`sentinelpulse-agent.wxs`) and `build-msi.ps1` to support public MSI properties (`API_BASE_URL`, `ENROLLMENT_TOKEN`) and automatically write `config.json` to `ProgramData\SentinelPulse\Agent\config.json`.
- [ ] Verify installer generation without failing clean developer environments.

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

- [ ] Inspect current Git remotes, branch, working tree, and untracked files before repository creation.
- [ ] Verify secrets, certificates, tokens, local environment files, logs, build artifacts, and generated files are excluded from the new repository.
- [ ] Create a new private GitHub repository for the SentinelPulse project.
- [ ] Commit the safe project state on the main branch.
- [ ] Push main to the new private repository and verify the remote tree and commit.
