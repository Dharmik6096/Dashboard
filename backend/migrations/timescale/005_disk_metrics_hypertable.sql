\set ON_ERROR_STOP on

-- V2.3 Step 1D, checkpoint 1: convert only disk_metrics.
-- Run only after taking and verifying a fresh pg_dump backup.
-- The transaction rolls back automatically if any invariant fails.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '0';

LOCK TABLE servers IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE disk_metrics IN ACCESS EXCLUSIVE MODE;

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
          AND hypertable_name = 'disk_metrics'
    ) THEN
        RAISE EXCEPTION 'disk_metrics is already a hypertable';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE confrelid = 'public.disk_metrics'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'unexpected foreign key references disk_metrics';
    END IF;
END
$preflight$;

CREATE TEMPORARY TABLE step1d_disk_metrics_before ON COMMIT DROP AS
SELECT
    COUNT(*)::bigint AS row_count,
    MIN(time) AS min_time,
    MAX(time) AS max_time
FROM disk_metrics;

TABLE step1d_disk_metrics_before;

ALTER TABLE disk_metrics DROP CONSTRAINT disk_metrics_pkey;
ALTER TABLE disk_metrics
    ADD CONSTRAINT disk_metrics_pkey PRIMARY KEY (id, time);

SELECT *
FROM create_hypertable(
    'disk_metrics',
    'time',
    migrate_data => TRUE
);

DO $verify$
DECLARE
    before_state record;
    after_state record;
BEGIN
    SELECT * INTO STRICT before_state
    FROM step1d_disk_metrics_before;

    SELECT
        COUNT(*)::bigint AS row_count,
        MIN(time) AS min_time,
        MAX(time) AS max_time
    INTO STRICT after_state
    FROM disk_metrics;

    IF before_state.row_count IS DISTINCT FROM after_state.row_count
       OR before_state.min_time IS DISTINCT FROM after_state.min_time
       OR before_state.max_time IS DISTINCT FROM after_state.max_time THEN
        RAISE EXCEPTION
            'disk_metrics invariant mismatch: before=(%, %, %), after=(%, %, %)',
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
FROM disk_metrics;

SELECT hypertable_schema, hypertable_name, num_dimensions, num_chunks
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public'
  AND hypertable_name = 'disk_metrics';

COMMIT;
