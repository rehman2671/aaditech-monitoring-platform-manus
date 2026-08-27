-- Explicit endpoint lifecycle evidence. Existing status values remain valid;
-- reason/timestamp are additive and nullable for legacy rows.
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
UPDATE endpoints SET status_changed_at = COALESCE(status_changed_at, last_seen, created_at)
WHERE status_changed_at IS NULL;
