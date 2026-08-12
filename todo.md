# SentinelPulse Complete End-to-End Implementation Todo

## Phase 1: Backlog & Acceptance Criteria
- [x] Audit missing platform modules and create verifiable remaining-work backlog.

## Phase 2: Schema & Backend Primitives
- [x] Expand database schema and tRPC procedures to support battery health, detailed network diagnostics, application usage, device health score, and device management (tags, departments, locations, asset IDs).
- [x] Implement backend database query helpers for heartbeats, stale device detection, and alert rules.

## Phase 3: Agent Runtime & MSI Release Pipeline
- [ ] Implement robust SQLite offline buffering and DPAPI encryption modules in the agent codebase.
- [ ] Implement an authenticated backend endpoint that compiles and serves versioned MSI installers.

## Phase 4: Durable Ingestion & Alert Engine
- [ ] Implement durable ingestion handler with idempotency key deduplication, exponential backoff, dead-letter queue, and heartbeat tracking.
- [ ] Implement automated alert evaluation worker for thresholds and check-in timeouts.

## Phase 5: Dashboard Modules & Report Generation
- [x] Update frontend components and pages to render battery, network, app usage, health score, and device management attributes.
- [x] Implement true CSV and formatted PDF report export functionality for fleet telemetry and alerts.

## Phase 6: Integration, Migration & Build Validation
- [ ] Run database migration SQL execution and verify Drizzle/SQL schema synchronization.
- [ ] Run comprehensive unit and integration test suites, TypeScript checks, and production builds.

## Phase 7: Checkpoint & Delivery
- [ ] Save final project checkpoint and deliver implementation report.

## Phase 5A: Report Delivery Hardening
- [ ] Serve generated CSV/PDF artifacts through a verified route and test returned download URLs end-to-end.
- [ ] Include actual alert records and richer telemetry fields in CSV and PDF outputs.
- [ ] Add end-to-end report generation and browser download validation from the dashboard header.
