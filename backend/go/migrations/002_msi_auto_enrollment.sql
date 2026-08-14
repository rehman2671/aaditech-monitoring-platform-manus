-- SentinelPulse automatic enrollment bootstrap migration.
-- This migration is additive and safe to run repeatedly on an existing local volume.

ALTER TABLE msi_build_jobs
    ADD COLUMN IF NOT EXISTS automatic_enrollment BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bootstrap_api_base_url TEXT,
    ADD COLUMN IF NOT EXISTS bootstrap_endpoint_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bootstrap_enrollment_token TEXT;

CREATE INDEX IF NOT EXISTS idx_msi_build_jobs_bootstrap_pending
    ON msi_build_jobs (status, automatic_enrollment)
    WHERE automatic_enrollment = TRUE;

-- The canonical enrollment token is always sp-enrol- followed by a UUID.
-- Existing rows are not modified; the check protects newly-created or updated rows.
ALTER TABLE enrollment_tokens
    DROP CONSTRAINT IF EXISTS enrollment_tokens_token_format_check;
ALTER TABLE enrollment_tokens
    ADD CONSTRAINT enrollment_tokens_token_format_check
    CHECK (token_hash ~ '^[0-9a-f]{64}$');
