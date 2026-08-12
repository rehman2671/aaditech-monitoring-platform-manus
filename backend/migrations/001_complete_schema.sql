-- SentinelPulse Production PostgreSQL & TimescaleDB Schema Migration

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    open_id VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(320),
    name TEXT,
    role VARCHAR(32) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_signed_in TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS endpoints (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
    hostname VARCHAR(255) NOT NULL,
    serial_number VARCHAR(128) NOT NULL,
    os_version VARCHAR(128),
    os_build VARCHAR(64),
    domain_or_workgroup VARCHAR(128),
    agent_version VARCHAR(64),
    status VARCHAR(32) DEFAULT 'online' NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS endpoint_api_keys (
    id VARCHAR(64) PRIMARY KEY,
    endpoint_id VARCHAR(64) NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollment_tokens (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
    token_hash TEXT NOT NULL,
    plain_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by_endpoint_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    metric VARCHAR(64) NOT NULL,
    condition VARCHAR(16) NOT NULL,
    threshold_value DECIMAL(10, 2) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    duration_minutes INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS system_alerts (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
    endpoint_id VARCHAR(64) NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    hostname VARCHAR(255) NOT NULL,
    rule_name TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE NOT NULL
);

-- Time-Series Metrics Tables for TimescaleDB
CREATE TABLE IF NOT EXISTS metrics_history (
    captured_at TIMESTAMPTZ NOT NULL,
    endpoint_id VARCHAR(64) NOT NULL,
    cpu_usage_percent DECIMAL(5, 2),
    ram_usage_percent DECIMAL(5, 2),
    disk_free_percent DECIMAL(5, 2),
    network_io_kbps DECIMAL(12, 2)
);

SELECT create_hypertable('metrics_history', 'captured_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS process_metrics (
    captured_at TIMESTAMPTZ NOT NULL,
    endpoint_id VARCHAR(64) NOT NULL,
    process_name VARCHAR(255) NOT NULL,
    pid INT NOT NULL,
    cpu_percent DECIMAL(5, 2),
    memory_mb DECIMAL(10, 2)
);

SELECT create_hypertable('process_metrics', 'captured_at', if_not_exists => TRUE);
