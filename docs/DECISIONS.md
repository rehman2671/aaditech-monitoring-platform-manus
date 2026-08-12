# SentinelPulse Architecture & Migration Decisions

## Decision 1: Go as Canonical Production Backend
- **Context**: The repository contained TypeScript Express and Fastify service scaffolds.
- **Decision**: Go 1.22+ is established as the sole canonical production backend.
- **Rationale**: Meets the performance, concurrency, static compilation, and portability requirements of an enterprise-grade EDR and endpoint monitoring platform.

## Decision 2: PostgreSQL + TimescaleDB for Persistence
- **Context**: The initial prototype used MySQL via Drizzle.
- **Decision**: PostgreSQL with TimescaleDB hypertables is the official persistence store.
- **Rationale**: Relational tables handle tenant and configuration data reliably, while Timescale hypertables optimize time-series telemetry storage, indexing, compression, and retention.

## Decision 3: Redis Streams for Ingestion Queue
- **Context**: Telemetry was previously processed via local JSON files or synchronous memory arrays.
- **Decision**: Redis Streams with consumer groups and explicit acknowledgements is mandated for durable event processing.
- **Rationale**: Guarantees at-least-once delivery, backpressure handling, worker scaling, and dead-letter queue isolation.

## Decision 4: Retention of .NET 8 Agent and WiX MSI
- **Context**: Rewriting the Windows agent in Go was considered.
- **Decision**: Retain the .NET 8 Windows Service agent and WiX v4 MSI installer.
- **Rationale**: Native access to WMI, CIM, performance counters, and Windows Service control is most robustly achieved via .NET on Windows.

## Decision 5: Removal of Production Preview Fallbacks
- **Context**: Frontend code retained preview sessions and local mock fallback data.
- **Decision**: All preview bypasses and hardcoded tenant fallbacks must be removed from production builds.
- **Rationale**: Satisfies the directive against mock, fake, or random data in production.
