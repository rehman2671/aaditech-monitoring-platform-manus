CREATE TABLE IF NOT EXISTS analyst_assessments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    endpoint_id TEXT NOT NULL,
    evidence_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    available BOOLEAN NOT NULL,
    unavailable_reason TEXT,
    assessment_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, endpoint_id, evidence_hash)
);

CREATE INDEX IF NOT EXISTS idx_analyst_assessments_tenant_endpoint_time
    ON analyst_assessments (tenant_id, endpoint_id, generated_at DESC);
