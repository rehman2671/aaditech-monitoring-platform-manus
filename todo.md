# SentinelPulse Production Master TODO

- [x] Phase 0: Architecture Freeze & Documentation (`docs/ARCHITECTURE.md`, `docs/SECURITY_MODEL.md`, `docs/AGENT_PROTOCOL.md`, `docs/DATA_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/THREAT_MODEL.md`)
- [x] Phase 1: Canonical Go Backend & Security Boundary (API routing, auth, RBAC, tenant context middleware, audit log, unit tests)
- [x] Phase 2: PostgreSQL & TimescaleDB Migration (Relational tables, hypertables, token hashing, migration runner, validation SQL script `docs/TIMESCALE_HYPERTABLE_VALIDATION.sql`)
- [x] Phase 3: Redis Streams & Workers (Producer, consumer group, persistence worker, alert rules, heartbeat checks)
- [x] Phase 4: Real .NET Agent & Offline Buffer (WMI collectors, DPAPI encryption, SQLite offline queue, retry backoff, WiX MSI, enrollment gate `docs/AGENT_ENROLLMENT_AND_WMI_SPEC.md`)
- [x] Phase 5: Dashboard Integration (Remove preview fallbacks, connect UI to canonical Go API, secure realtime and exports)
- [x] Phase 6: Packaging, Deployment & CI/CD (Docker Compose full-stack `docker-compose.full.yml`, Kubernetes manifests `sentinelpulse-full.yaml`, GitHub Actions matrix CI workflow `ci.yml`)
- [x] Phase 7: Acceptance Validation (End-to-end acceptance test suite `server/acceptance.test.ts`, security scan report `docs/SECURITY_SCAN_REPORT.md`, compliance verification checklist)
