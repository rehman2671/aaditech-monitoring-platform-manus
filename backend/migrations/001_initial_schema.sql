-- SentinelPulse Initial Schema Migration (PostgreSQL 15+ & TimescaleDB 2.x)
-- Written in node-pg-migrate compatible raw SQL format

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Organizations Table (Multi-tenant foundation)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users Table (Dashboard admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Argon2id hash
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Enrollment Tokens Table
CREATE TABLE enrollment_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by_endpoint_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Endpoints Table (Monitored Machines)
CREATE TABLE endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    os_version TEXT,
    os_build TEXT,
    domain_or_workgroup TEXT,
    agent_version TEXT,
    enrollment_token_id UUID REFERENCES enrollment_tokens(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'online', 'offline', 'disabled')),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key back-reference for enrollment_tokens
ALTER TABLE enrollment_tokens 
ADD CONSTRAINT fk_enrollment_endpoint 
FOREIGN KEY (used_by_endpoint_id) REFERENCES endpoints(id) ON DELETE SET NULL;

-- Endpoint API Keys Table
CREATE TABLE endpoint_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hardware Snapshots Table
CREATE TABLE hardware_snapshots (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_model TEXT,
    cpu_cores INT,
    cpu_logical_processors INT,
    gpu_model TEXT,
    ram_total_mb INT,
    motherboard_model TEXT,
    bios_version TEXT
);

-- Disks Table
CREATE TABLE disks (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    drive_letter TEXT NOT NULL,
    filesystem TEXT,
    total_gb BIGINT,
    free_gb BIGINT,
    used_gb BIGINT,
    smart_health TEXT CHECK (smart_health IN ('Healthy', 'Warning', 'Failing')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OS Health Table
CREATE TABLE os_health (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dism_status TEXT,
    sfc_status TEXT,
    driver_issues_count INT,
    reliability_score NUMERIC(3,1)
);

-- Software Inventory Table
CREATE TABLE software_inventory (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    publisher TEXT,
    version TEXT,
    installed_at TEXT,
    size_mb INT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Process Metrics Table (Time-series hypertable)
CREATE TABLE process_metrics (
    captured_at TIMESTAMPTZ NOT NULL,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    pid INT NOT NULL,
    name TEXT NOT NULL,
    cpu_percent NUMERIC(5,2),
    ram_mb INT,
    username TEXT
);
SELECT create_hypertable('process_metrics', 'captured_at', if_not_exists => TRUE);

-- Windows Event Logs Table
CREATE TABLE windows_event_logs (
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    level TEXT CHECK (level IN ('Information', 'Warning', 'Error', 'Critical')),
    provider TEXT,
    event_id INT,
    message TEXT
);

-- System Metrics History Table (TimescaleDB hypertable for CPU, RAM, Disk IO)
CREATE TABLE metrics_history (
    captured_at TIMESTAMPTZ NOT NULL,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    cpu_percent NUMERIC(5,2),
    ram_percent NUMERIC(5,2),
    disk_io_mbps NUMERIC(8,2)
);
SELECT create_hypertable('metrics_history', 'captured_at', if_not_exists => TRUE);

-- Alert Rules Table
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    condition TEXT NOT NULL,
    threshold_value NUMERIC(10,2),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Alerts Table
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id)
);
