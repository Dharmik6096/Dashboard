\set ON_ERROR_STOP on

-- V2.3 Step 1C, checkpoint 1: convert only container_metrics.
-- Run only after taking and verifying a fresh pg_dump backup.
-- The transaction rolls back automatically if any invariant fails.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '0';

-- Lock referenced tables before migrate_data to avoid deadlocks with
-- concurrent server/container updates. Stop metric ingestion first.
LOCK TABLE servers IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE containers IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE container_metrics IN ACCESS EXCLUSIVE MODE;

DO $preflight$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) THEN
        RAISE EXCEPTION 'timescaledb extension is not installed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_schema = 'public'
          AND hypertable_name = 'container_metrics'
    ) THEN
        RAISE EXCEPTION 'container_metrics is already a hypertable';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE confrelid = 'public.container_metrics'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'unexpected foreign key references container_metrics';
    END IF;
END
$preflight$;

CREATE TEMPORARY TABLE step1c_container_metrics_before ON COMMIT DROP AS
SELECT
    COUNT(*)::bigint AS row_count,
    MIN(time) AS min_time,
    MAX(time) AS max_time
FROM container_metrics;

TABLE step1c_container_metrics_before;

ALTER TABLE container_metrics DROP CONSTRAINT container_metrics_pkey;
ALTER TABLE container_metrics
    ADD CONSTRAINT container_metrics_pkey PRIMARY KEY (id, time);

SELECT *
FROM create_hypertable(
    'container_metrics',
    'time',
    migrate_data => TRUE
);

DO $verify$
DECLARE
    before_state record;
    after_state record;
BEGIN
    SELECT * INTO STRICT before_state
    FROM step1c_container_metrics_before;

    SELECT
        COUNT(*)::bigint AS row_count,
        MIN(time) AS min_time,
        MAX(time) AS max_time
    INTO STRICT after_state
    FROM container_metrics;

    IF before_state.row_count IS DISTINCT FROM after_state.row_count
       OR before_state.min_time IS DISTINCT FROM after_state.min_time
       OR before_state.max_time IS DISTINCT FROM after_state.max_time THEN
        RAISE EXCEPTION
            'container_metrics invariant mismatch: before=(%, %, %), after=(%, %, %)',
            before_state.row_count,
            before_state.min_time,
            before_state.max_time,
            after_state.row_count,
            after_state.min_time,
            after_state.max_time;
    END IF;
END
$verify$;

SELECT
    COUNT(*)::bigint AS row_count,
    MIN(time) AS min_time,
    MAX(time) AS max_time
FROM container_metrics;

SELECT hypertable_schema, hypertable_name, num_dimensions, num_chunks
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public'
  AND hypertable_name = 'container_metrics';

COMMIT;
