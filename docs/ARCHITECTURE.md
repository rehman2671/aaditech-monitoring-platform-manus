# SentinelPulse Production Architecture

## 1. System Overview

SentinelPulse is a self-hosted, migration-ready Windows Endpoint Monitoring & Diagnostics Platform. It provides end-to-end hardware, software, performance, and security telemetry collection via a native .NET 8 Windows Service agent, durable ingestion and processing through Redis Streams and Go microservices, relational and time-series persistence via PostgreSQL and TimescaleDB, and operator control through a secure React dashboard.

## 2. Canonical Topology

```text
React + TypeScript Dashboard
          │ HTTPS / Authenticated SSE
          ▼
Go API Service (Canonical Production Backend)
  - Authentication, RBAC, Tenant Context Isolation
  - Endpoint Management & One-Time Enrollment Tokens
  - Telemetry Ingestion, Heartbeats & Stale Check
  - Alert Rule Evaluation & Lifecycle Management
  - Command Dispatch & Audit Event Ledger
          │                              │
          │ (Publish & Consumer Groups)  │ (Relational & Hypertable Storage)
          ▼                              ▼
    Redis Streams                  PostgreSQL + TimescaleDB
```

## 3. Component Specifications

### 3.1 Frontend
- **Stack**: React 19, TypeScript, Tailwind CSS 4, Recharts.
- **Role**: Operator console for fleet health, endpoint drill-downs, alert management, token enrollment, and report downloads.
- **Constraint**: Must not rely on local preview state or unauthenticated mock data in production. All state is derived from authenticated canonical API sessions.

### 3.2 Canonical Backend
- **Language/Framework**: Go 1.22+ with standard library or lightweight router (`chi`/`gin`).
- **Role**: Single source of truth for all API requests, authentication, RBAC, tenant isolation, enrollment token hashing, alert processing, command dispatch, and audit logging.

### 3.3 Persistence Layer
- **PostgreSQL 15+ with TimescaleDB**:
  - **Relational Tables**: Organizations, users, memberships, roles, endpoints, enrollment tokens, alert rules, alert instances, audit logs, commands, and report metadata.
  - **Hypertables (TimescaleDB)**: CPU, memory, disk usage/I/O, network traffic/latency, battery, process snapshots, and system health metrics partitioned by time.

### 3.4 Ingestion & Queue
- **Redis Streams**: Durable telemetry and event buffering with consumer groups, explicit acknowledgements, retries, exponential backoff, and a dead-letter queue (DLQ) for poison messages.

### 3.5 Windows Agent
- **Runtime**: .NET 8 Windows Service (`win-x64`, self-contained).
- **Collectors**: Native WMI, CIM, and performance counters for hardware inventory, CPU, memory, disk, network adapters, battery, processes, services, software, and event logs.
- **Offline Buffer**: SQLite database protected by Windows DPAPI, providing ordered local queuing, automatic retry with backoff, dead-letter transition, and power-interruption recovery.

### 3.6 Installer
- **Packaging**: WiX Toolset v4 producing a versioned `.msi` package supporting unattended deployment (`/qn`), service registration, upgrade/downgrade validation, and secure ProgramData configuration ACLs.
