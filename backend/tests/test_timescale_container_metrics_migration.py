from pathlib import Path

from app.models.metric import ContainerMetric


BACKEND_ROOT = Path(__file__).resolve().parents[1]
CONVERSION_SQL = (
    BACKEND_ROOT / "migrations/timescale/003_container_metrics_hypertable.sql"
).read_text(encoding="utf-8")
RETENTION_SQL = (
    BACKEND_ROOT / "migrations/timescale/004_container_metrics_retention.sql"
).read_text(encoding="utf-8")
INIT_SQL = (BACKEND_ROOT / "migrations/init.sql").read_text(encoding="utf-8")


def normalized(sql: str) -> str:
    return " ".join(sql.lower().split())


def test_container_metric_orm_uses_timescale_compatible_composite_key():
    assert list(ContainerMetric.__table__.primary_key.columns.keys()) == ["id", "time"]


def test_conversion_is_container_metrics_only_and_migrates_existing_rows():
    sql = normalized(CONVERSION_SQL)

    assert "create_hypertable" in sql
    assert "'container_metrics'" in sql
    assert "migrate_data => true" in sql
    assert "primary key (id, time)" in sql
    assert "server_metrics" not in sql
    assert "disk_metrics" not in sql


def test_conversion_has_atomic_before_after_invariant_guard():
    sql = normalized(CONVERSION_SQL)

    assert CONVERSION_SQL.startswith("\\set ON_ERROR_STOP on")
    assert "begin;" in sql
    assert "count(*)::bigint as row_count" in sql
    assert "min(time) as min_time" in sql
    assert "max(time) as max_time" in sql
    assert "is distinct from" in sql
    assert "raise exception 'container_metrics invariant mismatch" in sql
    assert sql.endswith("commit;")


def test_conversion_contains_no_data_deletion_operations():
    sql = normalized(CONVERSION_SQL)

    assert "delete from" not in sql
    assert "truncate" not in sql
    assert "drop table" not in sql


def test_retention_is_separate_and_exactly_thirty_days():
    sql = normalized(RETENTION_SQL)

    assert "add_retention_policy" in sql
    assert "'container_metrics'" in sql
    assert "interval '30 days'" in sql
    assert "if_not_exists => true" in sql
    assert "create_hypertable" not in sql
    assert "server_metrics" not in sql
    assert "disk_metrics" not in sql


def test_fresh_install_schema_matches_container_metric_hypertable_contract():
    sql = normalized(INIT_SQL)
    container_section = sql.split("-- container metrics (time-series)", 1)[1].split(
        "-- disk metrics", 1
    )[0]

    assert "create extension if not exists timescaledb" in sql
    assert "create table if not exists container_metrics" in container_section
    assert "primary key (id, time)" in container_section
    assert "create_hypertable( 'container_metrics', 'time'" in container_section
    assert (
        "add_retention_policy( 'container_metrics', interval '30 days'"
        in container_section
    )
