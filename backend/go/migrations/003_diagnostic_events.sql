-- Migration 003: Diagnostic Audit Trail Events
CREATE TABLE IF NOT EXISTS diagnostic_events (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    component VARCHAR(32) NOT NULL, -- 'backend', 'runner', 'agent', 'portal'
    level VARCHAR(16) NOT NULL,     -- 'info', 'warn', 'error', 'success'
    category VARCHAR(64) NOT NULL,  -- 'build', 'enrollment', 'ingestion', 'telemetry'
    message TEXT NOT NULL,
    details TEXT,
    correlation_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_events_tenant_created ON diagnostic_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_events_correlation ON diagnostic_events (correlation_id);
