-- SentinelPulse Canonical PostgreSQL & TimescaleDB Production Migration
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    open_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'viewer',
    PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS endpoints (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64),
    os_version VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS endpoint_credentials (
    endpoint_id VARCHAR(64) PRIMARY KEY REFERENCES endpoints(id) ON DELETE CASCADE,
    device_token_hash VARCHAR(255) NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollment_tokens (
    token_hash VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    consumed_by_endpoint_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    operator VARCHAR(16) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 5,
    severity VARCHAR(32) NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS alert_instances (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id VARCHAR(64) REFERENCES alert_rules(id) ON DELETE CASCADE,
    endpoint_id VARCHAR(64) REFERENCES endpoints(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'firing',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commands (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
    endpoint_id VARCHAR(64) REFERENCES endpoints(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    payload TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64),
    user_id INT,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS endpoint_metrics_hyper (
    tenant_id VARCHAR(64) NOT NULL,
    endpoint_id VARCHAR(64) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    cpu_utilization DOUBLE PRECISION NOT NULL,
    ram_utilization DOUBLE PRECISION NOT NULL,
    disk_utilization DOUBLE PRECISION NOT NULL,
    temperature_c DOUBLE PRECISION,
    payload_json JSONB,
    PRIMARY KEY (tenant_id, endpoint_id, captured_at)
);

SELECT create_hypertable('endpoint_metrics_hyper', 'captured_at', if_not_exists => TRUE);
