-- Preserve truthful telemetry: unavailable collectors must remain NULL, never synthetic values.
ALTER TABLE endpoint_metrics_hyper
    ALTER COLUMN cpu_utilization DROP NOT NULL,
    ALTER COLUMN ram_utilization DROP NOT NULL,
    ALTER COLUMN disk_utilization DROP NOT NULL;
