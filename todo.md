# SentinelPulse End-to-End & Migration-Ready TODO

## Phase 1: Re-audit & Gap Identification
- [x] Re-read `monitoring-platform-spec.md` and audit existing project components
- [x] Identify exact gaps in database migrations, Fastify/Node backend services, C# Agent collectors, MSI packaging, and end-to-end integration

## Phase 2: Production Topology & Strategy
- [x] Document production deployment architecture in `PRODUCTION_ARCHITECTURE.md`
- [x] Define migration strategy, Redis stream consumer groups, TimescaleDB hypertables, and MSI packaging workflow

## Phase 3: Migration-Ready Backend Services & Database
- [ ] Create complete PostgreSQL + TimescaleDB migration SQL files (`backend/migrations/001_complete_schema.sql`)
- [x] Implement Fastify ingestion API (`backend/services/ingestion-api/`) with API key auth, payload validation, rate limiting, and Redis stream publishing
- [x] Implement Fastify processing worker (`backend/services/processing-worker/`) with Redis stream consumer, hypertable insertion, threshold evaluation, and alert dispatch
- [ ] Implement Fastify dashboard API (`backend/services/dashboard-api/`) with JWT auth, RBAC, fleet metrics, endpoint drill-downs, and alerting endpoints

## Phase 4: Agent Enrollment, Buffering & MSI Packaging Pipeline
- [ ] Implement complete C# .NET 8 agent modules (`agent/src/Program.cs`, `Worker.cs`, WMI collectors, SQLite buffer, DPAPI encryption, API client)
- [ ] Implement WiX/MSI build pipeline (`agent/packaging/sentinelpulse-agent.wxs` and build script) for portable `.msi` generation
- [x] Document Windows service installation, Group Policy rollout, and manual testing procedures

## Phase 5: Dashboard & End-to-End Integration Alignment
- [x] Connect React frontend to production API service contracts with mock/live environment switching
- [ ] Implement end-to-end integration test suite covering ingestion, alert evaluation, and dashboard queries

## Phase 6: Migration, Build & Packaging Validation
- [ ] Run PostgreSQL/TimescaleDB schema migration dry-run and validation
- [ ] Build backend services, test agent build/packaging pipeline, and run integration tests
- [ ] Verify all artifacts and generate complete documentation

## Phase 7: Delivery & Checkpoint
- [ ] Save final project checkpoint with all end-to-end migration and packaging assets attached
- [ ] Deliver detailed delivery report to user
