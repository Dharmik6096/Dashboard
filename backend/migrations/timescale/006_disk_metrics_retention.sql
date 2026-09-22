\set ON_ERROR_STOP on

-- V2.3 Step 1D, checkpoint 2: enable retention only after checkpoint 1
-- has completed and its before/after output has been reviewed.

BEGIN;

DO $preflight$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_schema = 'public'
          AND hypertable_name = 'disk_metrics'
    ) THEN
        RAISE EXCEPTION 'disk_metrics is not a TimescaleDB hypertable';
    END IF;
END
$preflight$;

SELECT add_retention_policy(
    'disk_metrics',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

SELECT job_id, application_name, schedule_interval, config
FROM timescaledb_information.jobs
WHERE hypertable_schema = 'public'
  AND hypertable_name = 'disk_metrics'
  AND proc_name = 'policy_retention';

COMMIT;
