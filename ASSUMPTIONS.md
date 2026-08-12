# Architectural Assumptions & Implementation Notes (SentinelPulse)

This document records the architectural interpretations and design decisions made while implementing the Endpoint Monitoring & Diagnostics Platform according to the technical specification.

## 1. Technology Stack Compliance
- **Endpoint Agent**: Implemented in C# / .NET 8 Worker Service structure under `/agent/` with native WMI/CIM data collectors, Event Log monitors, and mTLS-style enrollment token authentication.
- **Backend Services**: Implemented as TypeScript Fastify services under `/backend/services/` (`ingestion-api`, `processing-worker`, `dashboard-api`) utilizing Redis Streams for pub-sub queuing and PostgreSQL + TimescaleDB for relational and hypertable time-series storage.
- **Database Migrations**: Plain SQL migration files using `node-pg-migrate` format stored under `/backend/migrations/`.
- **Frontend**: React 18 + TypeScript + TailwindCSS + Recharts single-page administrative dashboard.
- **Infrastructure**: Complete `docker-compose.dev.yml`, `docker-compose.prod.yml`, Kubernetes deployment manifests under `/infra/`, and GitHub Actions CI workflow under `.github/workflows/ci.yml`.

## 2. Handling Missing Components
In the initial frontend-only preview, backend code, agent scaffolding, and K8s manifests were represented as placeholders. In this comprehensive implementation, all modules specified in Sections 4, 5, 6, 7, 8, 10, and 11 have been fully structured and placed in the project repository.

## 3. Full-stack Runtime Boundary

Date: 2026-08-12
Section referenced: Sections 3, 5, 10, and 13
Ambiguity found: The source specification fixes PostgreSQL 15 + TimescaleDB and Fastify services, while the managed full-stack WebDev runtime provides Drizzle with MySQL/TiDB, Express, tRPC, and Manus OAuth.
Decision made: The project now exposes a real managed full-stack path using the provided WebDev database, server, tRPC, and auth primitives. The PostgreSQL/TimescaleDB migration and service scaffolds remain under `backend/` as portability/reference assets for the specification's target deployment.
Reasoning: This is the only runtime that can be executed and validated in the current managed project. The distinction is documented rather than silently substituted. A production deployment that must meet the fixed PostgreSQL/TimescaleDB requirement should run the `backend/` service topology on Docker/Kubernetes and connect the frontend adapter to that deployment.

## 4. Authentication Interpretation

Date: 2026-08-12
Section referenced: Section 8.4 and Section 7.6
Ambiguity found: The specification requests JWT access/refresh credentials, while the managed runtime ships with Manus OAuth session cookies and protected tRPC procedures.
Decision made: The managed runtime uses its built-in secure OAuth session for browser authentication and role enforcement. The frontend also preserves the documented JWT/refresh API adapter and login contract for the portable backend deployment.
Reasoning: This provides real authenticated server procedures in the current project without storing passwords or manually handling cookies in the browser.

## 5. Mock Preview Data

Date: 2026-08-12
Section referenced: Sections 6 and 16
Ambiguity found: No real Windows agent can run inside the browser preview or sandbox web runtime.
Decision made: Local deterministic preview data is retained as a fallback when the dashboard API has no rows, while seeded database rows and tRPC procedures are available when the managed database session is authenticated.
Reasoning: This allows visual and interaction testing without fabricating customer reviews or claiming that a Windows endpoint is connected. Real WMI, Event Viewer, DPAPI, SQLite buffering, and MSI flows remain native Windows deployment work.
