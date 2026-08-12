# SentinelPulse Implementation Roadmap

## Phase 0: Architecture Freeze & Documentation (Completed)
Establish authoritative documentation for architecture, production gap analysis, key decisions, and phased roadmap.

## Phase 1: Canonical Go Backend & Security Boundary
Develop the Go backend module, establish typed API contracts, enforce tenant scoping middleware, and implement strict authentication and audit logging.

## Phase 2: PostgreSQL & TimescaleDB Migration
Transition the data layer from MySQL Drizzle to PostgreSQL and TimescaleDB hypertables, including secure one-time enrollment token hashing and schema migrations.

## Phase 3: Redis Streams & Processing Workers
Implement Redis Streams ingestion publishing, consumer group telemetry persistence, heartbeat tracking, and alert rule evaluation engines.

## Phase 4: Native .NET 8 Agent & Offline Buffer
Enhance the Windows Service agent with real WMI/CIM/performance collectors, DPAPI encryption, SQLite offline buffering, exponential backoff retries, and dead-letter handling.

## Phase 5: Dashboard Integration
Remove preview bypasses from the React frontend, connect all UI views and mutations to canonical APIs, and implement secure tenant-scoped real-time updates and report downloads.

## Phase 6: Packaging, Deployment & CI/CD
Produce the production Docker Compose topology, Kubernetes manifests, WiX MSI compilation pipeline, and automated GitHub Actions verification gates.
