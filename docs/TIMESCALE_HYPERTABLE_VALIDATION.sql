-- ============================================================================
-- SentinelPulse TimescaleDB Hypertable & Migration Validation Script
-- Target: PostgreSQL 15+ with TimescaleDB Extension Enabled
-- ============================================================================

-- 1. Ensure TimescaleDB extension is active
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Create base telemetry metrics table with tenant isolation and temporal partitioning key
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

-- 3. Convert table into a TimescaleDB hypertable partitioned on captured_at
SELECT create_hypertable('endpoint_metrics_hyper', 'captured_at', if_not_exists => TRUE);

-- 4. Create compression policy to compress chunks older than 7 days
ALTER TABLE endpoint_metrics_hyper SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'tenant_id, endpoint_id'
);
SELECT add_compression_policy('endpoint_metrics_hyper', INTERVAL '7 days', if_not_exists => TRUE);

-- 5. Validation Assertions & Metadata Inspection
-- Verify hypertable status
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'endpoint_metrics_hyper';

-- Verify chunk intervals and compression status
SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'endpoint_metrics_hyper';
