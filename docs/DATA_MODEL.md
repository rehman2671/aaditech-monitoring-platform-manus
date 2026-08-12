# SentinelPulse Target Data Model (PostgreSQL & TimescaleDB)

## 1. Relational Entities (PostgreSQL)

### 1.1 `organizations`
- **Purpose**: Multi-tenant root entity grouping users, endpoints, rules, and telemetry.
- **Tenant Relationship**: Root parent table.
- **Key Columns**: `id` (PK, VARCHAR/UUID), `name` (VARCHAR), `created_at` (TIMESTAMPTZ).

### 1.2 `users`
- **Purpose**: Operator and administrator dashboard accounts.
- **Tenant Relationship**: Belongs to one `organization_id`.
- **Key Columns**: `id` (PK), `organization_id` (FK), `email` (UNIQUE), `password_hash`, `role` (`admin` | `viewer`), `created_at`, `updated_at`.

### 1.3 `endpoints`
- **Purpose**: Monitored Windows machines.
- **Tenant Relationship**: Belongs to one `organization_id`.
- **Key Columns**: `id` (PK), `organization_id` (FK), `hostname`, `serial_number`, `os_version`, `os_build`, `agent_version`, `status` (`online` | `offline` | `warning`), `last_seen_at`, `created_at`.

### 1.4 `enrollment_tokens`
- **Purpose**: One-time token records for secure agent registration.
- **Tenant Relationship**: Belongs to one `organization_id`.
- **Key Columns**: `id` (PK), `organization_id` (FK), `token_hash` (UNIQUE, stores cryptographic hash only), `expires_at`, `used_by_endpoint_id` (FK, nullable), `created_at`.

### 1.5 `alert_rules` and `system_alerts`
- **Purpose**: Configurable threshold rules and triggered alert instances.
- **Tenant Relationship**: Scored and evaluated per `organization_id`.
- **Key Columns (`system_alerts`)**: `id` (PK), `organization_id` (FK), `endpoint_id` (FK), `rule_id` (FK), `severity` (`warning` | `critical`), `message`, `status` (`firing` | `acknowledged` | `resolved`), `triggered_at`, `acknowledged_at`, `resolved_at`.

### 1.6 `audit_logs`
- **Purpose**: Immutable administrative action trail.
- **Tenant Relationship**: Associated with `organization_id`.
- **Key Columns**: `id` (PK), `organization_id` (FK), `actor`, `action`, `target`, `outcome`, `ip_address`, `created_at`.

---

## 2. Time-Series Hypertables (TimescaleDB)

### 2.1 `telemetry_metrics`
- **Purpose**: Partitioned time-series table storing high-frequency CPU, RAM, disk, network, and battery samples.
- **Tenant Relationship**: Indexed by `organization_id` and `endpoint_id`.
- **Key Columns**: `captured_at` (TIMESTAMPTZ, partitioning dimension), `organization_id`, `endpoint_id`, `metric_type`, `cpu_percent`, `ram_percent`, `disk_free_percent`, `network_latency_ms`, `battery_charge_percent`.
- **Indexing**: Composite index on `(endpoint_id, captured_at DESC)` for fast time-series retrieval.
