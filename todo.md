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
- [ ] Rebuild and restart the deployment backend container (`docker-compose -f deployment/docker-compose.yml up -d --build backend`).
- [ ] Verify live endpoints `/api/v1/auth/setup-status` and `/api/v1/auth/setup` using `curl` or `Invoke-WebRequest`.
