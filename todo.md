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
- [ ] Fix `REDIS_URL` in local Compose configuration for the Go Redis client and revalidate `/health/ready`.
- [ ] Start and validate the local frontend dashboard without disrupting existing Sophos containers.
- [ ] Install .NET 8 and WiX v4 or use a verified MSI artifact for the Windows agent.
- [ ] Confirm target endpoint and secure enrollment token before agent installation/enrollment.
- [ ] Verify real WMI telemetry, endpoint commands, and audit persistence end to end.
- [ ] Save a final checkpoint only after full local deployment validation.

Deployment findings: the target workspace is populated and SentinelPulse TimescaleDB, Redis, and Go backend containers are running. `/health/live` returns HTTP 200. `/health/ready` is currently unhealthy because `REDIS_URL=redis://redis:6379/0` is parsed as an invalid TCP address by the canonical Go backend. Existing `sophos_platform` containers remain running and were not stopped. Windows has Docker and Node/npm, but Git, .NET SDK, WiX, and pnpm are not currently available.
- [ ] Fix Windows agent DPAPI scope enum compile error (`DataProtectionScope.Machine` must use the .NET-supported machine scope value) and rerun Release build.
- [ ] Update the MSI build script from WiX v3 `candle.exe`/`light.exe` calls to the installed WiX v4 `wix build` command, then produce and checksum a real MSI artifact.
- [ ] Remove the agent's hardcoded placeholder token and hardcoded remote API URL; require explicit local API configuration and a real enrollment credential.
- [ ] Correct agent enrollment payload/response handling to match the canonical Go backend (`endpoint_id`, `hostname`, and returned `device_token`).
- [ ] Rebuild and upgrade the installed Windows service after the fail-closed agent configuration fix.
- [x] Provide a Command-Prompt-safe elevated PowerShell execution path for the SentinelPulse agent MSI upgrade.
- [x] Verify local SentinelPulse backend readiness, Windows service execution, and agent MSI packaging.
- [x] Add a production Nginx frontend container to `deployment/docker-compose.yml` and a corresponding `frontend.Dockerfile` so the React dashboard runs in Docker alongside the Go backend.
- [x] Validate the new frontend Docker image by building it and proxying API traffic to the Go backend.
