# SentinelPulse Specification Audit & Missing Modules Implementation Todo

## Phase 1: Gap Audit & Review
- [x] Read and cross-check `monitoring-platform-spec.md` with current codebase
- [x] Identify missing modules (C# Agent source structure, Backend Ingestion/Processing/Dashboard API contracts, TimescaleDB schema migrations, Docker/K8s manifests, CI/CD pipeline)
- [x] Document findings in `ASSUMPTIONS.md` and `todo.md`

## Phase 2: Architecture & Backlog Finalization
- [x] Finalize database schema migration files (`node-pg-migrate` format for PostgreSQL + TimescaleDB hypertables)
- [x] Define REST and WebSocket API contracts (Ingestion, Processing, Dashboard)
- [x] Finalize .NET 8 Worker Service agent structure (`agent/src/Collectors/`, `Communication/`, `Enrollment/`)

## Phase 3: Backend, Agent Scaffold, Infrastructure & CI/CD Implementation
- [x] Implement database migration scripts for all 10 required tables (organizations, users, endpoints, enrollment_tokens, endpoint_api_keys, hardware_snapshots, disks, os_health, software_inventory, process_metrics, metrics_history, alert_rules, system_alerts)
- [x] Implement C# .NET 8 Worker Service scaffold (`Program.cs`, `Worker.cs`, WMI/CIM collectors, secure API key enrollment)
- [x] Implement backend API services scaffold (`ingestion-api`, `processing-worker`, `dashboard-api` with Fastify + `pg` + Redis streams)
- [x] Implement infrastructure manifests (`docker-compose.dev.yml`, `docker-compose.prod.yml`, Kubernetes deployment manifests)
- [x] Implement GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`)

## Phase 4: Frontend Alignment & Polish
- [x] Align React frontend with complete backend data contracts, live WebSocket feeds, and real-time telemetry management
- [x] Ensure all 5 requested sections and modules from the spec are fully accessible and interactive in the dashboard

## Phase 5: Build, Test & Validation
- [x] Run TypeScript compilation, lint checks, and verify component integrity
- [x] Capture final verification screenshots and save project checkpoint

## Phase 6: Final Delivery
- [x] Deliver comprehensive summary and final project version attachment

## Phase 7: Full-stack Completion Pass
- [x] Upgrade the project to the managed full-stack template with database, server procedures, and authentication
- [x] Add persistent monitoring schema for organizations, endpoints, alert rules, system alerts, and enrollment tokens
- [x] Add typed tRPC procedures for summary, endpoints, alerts, enrollment tokens, acknowledgment, and token generation
- [x] Seed the managed database with specification-aligned organization, endpoint, alert, and threshold-rule records
- [x] Wire authenticated tRPC queries and mutations into the existing dashboard with preview fallback
- [x] Add API contract, agent runtime, buffering, DPAPI, and deployment-boundary documentation
- [x] Run production build, TypeScript validation, Vitest, database validation, and visual screenshots
- [ ] Replace preview fallback with a deployed Windows agent fleet and real WMI/DPAPI/SQLite runtime
- [ ] Deploy the portable PostgreSQL/TimescaleDB + Fastify + Redis service topology when external infrastructure is available
