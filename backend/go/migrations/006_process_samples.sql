-- Historical process evidence is additive and tenant-scoped.
-- Nullable columns represent evidence the Windows collector could not observe;
-- no synthetic values are introduced by this table.
CREATE TABLE IF NOT EXISTS endpoint_process_samples (
    tenant_id VARCHAR(64) NOT NULL,
    endpoint_id VARCHAR(64) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    pid INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    executable_path TEXT,
    command_line TEXT,
    publisher TEXT,
    signature TEXT,
    executable_hash VARCHAR(128),
    parent_pid INTEGER,
    parent_name VARCHAR(255),
    start_time TIMESTAMPTZ,
    user_session VARCHAR(255),
    cpu_percent DOUBLE PRECISION,
    cpu_time_seconds DOUBLE PRECISION,
    working_set_bytes BIGINT,
    private_bytes BIGINT,
    virtual_bytes BIGINT,
    thread_count INTEGER,
    handle_count INTEGER,
    priority INTEGER,
    integrity_level VARCHAR(64),
    state VARCHAR(32) NOT NULL DEFAULT 'unknown',
    availability VARCHAR(32) NOT NULL DEFAULT 'OBSERVED',
    payload_json JSONB,
    PRIMARY KEY (tenant_id, endpoint_id, captured_at, pid)
);

CREATE INDEX IF NOT EXISTS endpoint_process_samples_endpoint_time_idx
    ON endpoint_process_samples (tenant_id, endpoint_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS endpoint_process_samples_tenant_time_idx
    ON endpoint_process_samples (tenant_id, captured_at DESC);
