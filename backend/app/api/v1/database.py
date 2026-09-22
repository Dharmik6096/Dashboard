"""
Database Monitoring API — READ-ONLY Observability

Safety Principles (CRITICAL):
- All queries are read-only SELECT against DevOps Monitor's own PostgreSQL.
- Zero queries are executed against monitored/production databases.
- Zero remote writes, zero container changes, zero DB mutations.
- Docker CPU/RAM data comes from the existing `container_metrics` table
  (populated by the lightweight docker stats collector — NOT queried here live).
- All endpoints are aggressively cached in Redis to reduce DB load.
- Statement timeouts guard every SQL execution.
- Frontend auto-refresh is gated to ≥30s; chart data is gated to ≥60s.

Collection frequencies (enforced via cache TTLs):
  Fleet snapshot / health:      30 s
  Chart time-series:            60 s
  Alerts:                       30 s
  Detail / single container:    30 s

No engine-specific collectors run yet. When added they must:
  - Use read-only metadata views / sys tables only
  - Enforce 3-second query timeout per query
  - Use a monitored connection pool (max 1 conn per DB)
  - Never enable profiling on production DBs automatically
"""
from typing import Optional, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, text, String
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone, timedelta
import json

from app.database import get_db
from app.models.container import Container
from app.models.server import Server
from app.models.alert import Alert
from app.models.metric import ContainerMetric
from app.redis_client import cache_get, cache_set

router = APIRouter(tags=["Database"])

# ─────────────────────────────────────────────────────────────────
# CONFIGURATION — Collection safety limits
# ─────────────────────────────────────────────────────────────────
# DB keywords identifying database/data-store containers
DB_KEYWORDS = [
    "postgres", "pgbouncer", "mysql", "percona", "mariadb",
    "mongo", "mssql", "sqlserver", "oracle", "cassandra",
    "cockroach", "tidb"
]

# Cache TTLs (seconds) — tune for collection frequency control
CACHE_TTL = {
    "fleet":        30,    # Health snapshot, summary cards
    "chart":        60,    # Time-series charts (no need for 10s polling)
    "alerts":       30,    # Alert feed
    "detail":       30,    # Single container detail
    "environments": 120,   # Environment list (very static)
}

# Statement timeout for all our own Postgres queries (milliseconds)
# This guards against any unexpectedly slow internal queries.
OWN_DB_STATEMENT_TIMEOUT_MS = 8000

ENGINE_MAP: Dict[str, str] = {
    "postgres":   "PostgreSQL",
    "pgbouncer":  "PostgreSQL",
    "percona":    "MySQL",
    "mysql":      "MySQL",
    "mariadb":    "MariaDB",
    "mongo":      "MongoDB",
    "mssql":      "SQL Server",
    "sqlserver":  "SQL Server",
    "oracle":     "Oracle",
    "cassandra":  "Cassandra",
    "cockroach":  "CockroachDB",
    "tidb":       "TiDB",
}

ENGINE_COLORS: Dict[str, str] = {
    "PostgreSQL": "#336791",
    "MySQL":      "#f29111",
    "MariaDB":    "#c0765a",
    "MongoDB":    "#47a248",
    "SQL Server": "#cc2927",
    "Oracle":     "#e03a00",
    "Cassandra":  "#1287b1",
    "CockroachDB":"#6933ff",
    "TiDB":       "#e63c2f",
    "Unknown":    "#6b7280",
}

SUPPORTED_ENGINES = ["PostgreSQL", "MySQL", "MariaDB", "MongoDB", "SQL Server"]



# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def get_engine(image: str) -> str:
    if not image:
        return "Unknown"
    img = image.lower()
    for kw, engine in ENGINE_MAP.items():
        if kw in img:
            return engine
    return "Unknown"


def get_version(image: str) -> str:
    if not image:
        return "unknown"
    if ":" in image:
        tag = image.split(":")[-1]
        for suf in ["-alpine", "-slim", "-bookworm", "-bullseye", "-buster", "-focal", "-jammy"]:
            tag = tag.replace(suf, "")
        return tag
    return "latest"


def parse_ports(ports_raw) -> str:
    if not ports_raw:
        return "Internal"
    if isinstance(ports_raw, list):
        parts = []
        for p in ports_raw:
            if isinstance(p, dict):
                pub = p.get("PublicPort")
                pri = p.get("PrivatePort")
                if pub and pri:
                    parts.append(f"{pub}→{pri}")
                elif pri:
                    parts.append(str(pri))
        return ", ".join(parts) if parts else "Internal"
    if isinstance(ports_raw, dict):
        return str(ports_raw)[:80]
    return str(ports_raw)[:80]


def parse_volumes(volumes_raw) -> str:
    if not volumes_raw:
        return "None"
    if isinstance(volumes_raw, list):
        return ", ".join(str(v) for v in volumes_raw[:3])
    if isinstance(volumes_raw, dict):
        return ", ".join(list(volumes_raw.keys())[:3])
    return str(volumes_raw)[:100]


def get_uptime_seconds(started_at) -> int:
    if not started_at:
        return 0
    now = datetime.now(timezone.utc)
    started = started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    return max(0, int((now - started).total_seconds()))


def determine_status(c: Container) -> str:
    """
    Determine health from Docker-collected data only.
    No remote DB queries are run here.
    """
    if not c.status or c.status.lower() != "running":
        return "Critical"

    cpu = c.last_cpu_percent or 0
    mem_pct = 0.0
    if c.last_mem_limit and c.last_mem_limit > 0 and c.last_mem_usage:
        mem_pct = (c.last_mem_usage / c.last_mem_limit) * 100

    # Stale: no update in >10 minutes
    if c.last_seen:
        ls = c.last_seen
        if ls.tzinfo is None:
            ls = ls.replace(tzinfo=timezone.utc)
        stale_mins = (datetime.now(timezone.utc) - ls).total_seconds() / 60
        if stale_mins > 10:
            return "Stale"

    if cpu > 85 or mem_pct > 90:
        return "Critical"
    if cpu > 70 or mem_pct > 80:
        return "Warning"
    return "Healthy"


def container_to_db_item(c: Container) -> dict:
    """
    Convert a Container ORM object to a database monitoring item.
    All resource data (CPU, RAM) comes from the Docker stats collector
    already stored in our own DB — no remote DB queries involved.
    """
    mem_pct = 0.0
    if c.last_mem_limit and c.last_mem_limit > 0 and c.last_mem_usage:
        mem_pct = (c.last_mem_usage / c.last_mem_limit) * 100

    return {
        "id":               str(c.id),
        "server_id":        str(c.server_id),
        "server_name":      c.server.name if c.server else "Unknown",
        "server_env":       c.server.environment if c.server else "unknown",
        "container_id":     c.container_id,
        "container_name":   c.name.lstrip("/"),
        "engine":           get_engine(c.image),
        "engine_version":   get_version(c.image or ""),
        "database_name":    c.name.lstrip("/"),
        "image":            c.image or "unknown",
        "status":           determine_status(c),
        # Docker-sourced resource data — NOT from remote DB queries
        "cpu_percent":      round(c.last_cpu_percent or 0, 2),
        "memory_usage":     c.last_mem_usage or 0,
        "memory_limit":     c.last_mem_limit or 0,
        "memory_percent":   round(mem_pct, 2),
        # Engine-specific fields — None until engine collector is configured
        "storage_bytes":    0,
        "connections":      None,    # Requires engine-specific collector
        "max_connections":  None,    # Requires engine-specific collector
        "qps":              None,    # Requires engine-specific collector
        "response_time_ms": None,    # Requires engine-specific collector
        "replication_role": "Standalone",
        "replication_lag_ms": None,
        # Container metadata
        "published_ports":  parse_ports(c.ports),
        "docker_network":   c.network_mode or "bridge",
        "volume_mounts":    parse_volumes(c.volumes),
        "uptime_seconds":   get_uptime_seconds(c.started_at),
        "last_seen":        c.last_seen.isoformat() if c.last_seen else None,
        "created_at_docker":c.created_at_docker.isoformat() if c.created_at_docker else None,
        "health_status":    c.health_status,
        "restart_count":    c.restart_count or 0,
        "oom_killed":       c.oom_killed or False,
        # Observability metadata
        "data_source":      "docker_stats",     # tells frontend what data comes from
        "engine_telemetry": False,              # True once engine collector is wired
    }


async def _set_timeout(db: AsyncSession) -> None:
    """Apply statement timeout to protect our own DB from slow queries."""
    await db.execute(text(f"SET LOCAL statement_timeout = {OWN_DB_STATEMENT_TIMEOUT_MS}"))


# ─────────────────────────────────────────────────────────────────
# GET /databases  — Fleet snapshot (cached 30 s)
# ─────────────────────────────────────────────────────────────────
@router.get("/databases")
async def get_databases(
    server_id:   Optional[str] = Query(None),
    engine:      Optional[str] = Query(None),
    status:      Optional[str] = Query(None),
    environment: Optional[str] = Query(None),
    search:      Optional[str] = Query(None),
    sort_by:     Optional[str] = Query("name"),
    sort_dir:    Optional[str] = Query("asc"),
    page:        int = Query(1, ge=1),
    page_size:   int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Cache key — include all filter params so each unique query is cached
    cache_key = (
        f"db:fleet:{server_id}:{engine}:{status}:{environment}:"
        f"{search}:{sort_by}:{sort_dir}:{page}:{page_size}"
    )
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    # Apply timeout to our own DB query
    await _set_timeout(db)

    # Query only containers matching DB image keywords
    conditions = [Container.image.ilike(f"%{kw}%") for kw in DB_KEYWORDS]
    query = (
        select(Container)
        .options(joinedload(Container.server))
        .where(or_(*conditions))
        .where(Container.status.isnot(None))
    )
    if server_id and server_id.lower() not in ("all", "all servers"):
        query = query.where(Container.server_id.cast(String) == server_id)

    result = await db.execute(query)
    all_containers = result.scalars().all()

    # Build items and apply in-Python filters
    all_items = []
    for c in all_containers:
        item = container_to_db_item(c)

        if engine and engine.lower() not in ["all", "all-engines", "all types", ""]:
            if item["engine"].lower() != engine.lower():
                continue
        if environment and environment.lower() not in ["all", "all environments", ""]:
            if item["server_env"].lower() != environment.lower():
                continue
        if status and status.lower() not in ["all", "all status", ""]:
            if item["status"].lower() != status.lower():
                continue
        if search:
            s = search.lower()
            if not any([
                s in item["database_name"].lower(),
                s in item["container_name"].lower(),
                s in item["server_name"].lower(),
                s in item["engine"].lower(),
            ]):
                continue

        all_items.append(item)

    # Sort
    valid_sort = {
        "name":   "database_name",
        "engine": "engine",
        "status": "status",
        "cpu":    "cpu_percent",
        "ram":    "memory_percent",
        "uptime": "uptime_seconds",
    }
    sort_key = valid_sort.get(sort_by or "name", "database_name")
    reverse = (sort_dir or "asc").lower() == "desc"
    all_items.sort(key=lambda x: (x.get(sort_key) or ""), reverse=reverse)

    # Aggregate stats
    total   = len(all_items)
    healthy = sum(1 for x in all_items if x["status"] == "Healthy")
    warning = sum(1 for x in all_items if x["status"] == "Warning")
    critical= sum(1 for x in all_items if x["status"] == "Critical")
    stale   = sum(1 for x in all_items if x["status"] == "Stale")
    avg_cpu = round(sum(x["cpu_percent"] for x in all_items) / total, 2) if total > 0 else 0
    avg_ram = round(sum(x["memory_percent"] for x in all_items) / total, 2) if total > 0 else 0

    engines_counts: Dict[str, int] = {}
    for x in all_items:
        engines_counts[x["engine"]] = engines_counts.get(x["engine"], 0) + 1

    top_cpu = sorted(all_items, key=lambda x: x["cpu_percent"], reverse=True)[:8]
    top_by_connections = [x for x in all_items if x["connections"] is not None]
    top_by_connections = sorted(top_by_connections, key=lambda x: x["connections"], reverse=True)[:8]

    # Paginate
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    page_items = all_items[offset: offset + page_size]

    envs = sorted(set(x["server_env"] for x in all_items if x["server_env"]))

    response = {
        "items":              page_items,
        "total":              total,
        "page":               page,
        "page_size":          page_size,
        "total_pages":        total_pages,
        "healthy":            healthy,
        "warning":            warning,
        "critical":           critical,
        "stale":              stale,
        "avg_cpu":            avg_cpu,
        "avg_ram":            avg_ram,
        "storage_used":       0,
        "engines":            engines_counts,
        "top_cpu":            top_cpu,
        "top_by_connections": top_by_connections,
        "environments":       envs,
        # Observability metadata
        "collected_at":       datetime.now(timezone.utc).isoformat(),
        "data_source":        "docker_stats",
        "cache_ttl_seconds":  CACHE_TTL["fleet"],
        "engine_telemetry":   False,
        "impact_note":        "All data sourced from local Docker stats collector. Zero queries executed against monitored databases.",
    }

    await cache_set(cache_key, json.dumps(response), ttl=CACHE_TTL["fleet"])
    return response


# ─────────────────────────────────────────────────────────────────
# GET /databases/chart-data — time-series from container_metrics (cached 60 s)
# ─────────────────────────────────────────────────────────────────
@router.get("/databases/chart-data")
async def get_database_chart_data(
    period: str = Query("1h"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns time-series CPU/Memory data from our own container_metrics table.
    This is data ALREADY collected by the Docker stats collector —
    no additional queries to monitored databases are made.
    """
    cache_key = f"db:chart:{period}"
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    await _set_timeout(db)

    period_map = {
        "5m":  (timedelta(minutes=5),   "1 minute"),
        "15m": (timedelta(minutes=15),  "1 minute"),
        "1h":  (timedelta(hours=1),     "1 minute"),
        "6h":  (timedelta(hours=6),     "5 minutes"),
        "24h": (timedelta(hours=24),    "15 minutes"),
        "7d":  (timedelta(days=7),      "1 hour"),
    }
    delta, _bucket_label = period_map.get(period, (timedelta(hours=1), "1 minute"))
    since = datetime.now(timezone.utc) - delta

    # Find DB containers
    conditions = [Container.image.ilike(f"%{kw}%") for kw in DB_KEYWORDS]
    containers_q = await db.execute(
        select(Container.id, Container.name, Container.image)
        .where(or_(*conditions))
    )
    db_containers = containers_q.all()

    if not db_containers:
        resp = {
            "series": [], "has_data": False, "period": period,
            "message": "No database containers found in monitoring scope.",
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
        await cache_set(cache_key, json.dumps(resp), ttl=CACHE_TTL["chart"])
        return resp

    container_ids = [c.id for c in db_containers]
    container_map = {
        c.id: {"name": c.name.lstrip("/"), "engine": get_engine(c.image)}
        for c in db_containers
    }

    # Query our own container_metrics table (no remote DB access)
    # Using standard date_trunc (compatible with all Postgres versions)
    sql = text("""
        SELECT
            date_trunc('minute', time) AS bucket,
            container_db_id,
            round(AVG(cpu_percent)::numeric, 2)  AS avg_cpu,
            round(AVG(mem_percent)::numeric, 2)  AS avg_mem,
            round(AVG(net_rx_rate)::numeric, 2)  AS avg_rx,
            round(AVG(net_tx_rate)::numeric, 2)  AS avg_tx
        FROM container_metrics
        WHERE container_db_id = ANY(:ids)
          AND time >= :since
        GROUP BY bucket, container_db_id
        ORDER BY bucket ASC
    """)

    rows = await db.execute(sql, {"ids": container_ids, "since": since})
    data = rows.fetchall()

    if not data:
        resp = {
            "series": [], "has_data": False, "period": period,
            "message": f"No metric history available in the {period} window.",
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
        await cache_set(cache_key, json.dumps(resp), ttl=CACHE_TTL["chart"])
        return resp

    # Organise per-container series
    series_map: Dict[str, dict] = {}
    for row in data:
        cid = str(row.container_db_id)
        if cid not in series_map:
            info = container_map.get(row.container_db_id, {"name": "unknown", "engine": "Unknown"})
            series_map[cid] = {"id": cid, "name": info["name"], "engine": info["engine"], "data": []}
        series_map[cid]["data"].append({
            "time": row.bucket.isoformat(),
            "cpu":  float(row.avg_cpu or 0),
            "mem":  float(row.avg_mem or 0),
            "rx":   float(row.avg_rx or 0),
            "tx":   float(row.avg_tx or 0),
        })

    resp = {
        "series": list(series_map.values()),
        "has_data": True,
        "period": period,
        "data_source": "container_metrics",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "cache_ttl_seconds": CACHE_TTL["chart"],
    }
    await cache_set(cache_key, json.dumps(resp), ttl=CACHE_TTL["chart"])
    return resp


# ─────────────────────────────────────────────────────────────────
# GET /databases/alerts — recent alerts linked to DB containers (cached 30 s)
# ─────────────────────────────────────────────────────────────────
@router.get("/databases/alerts")
async def get_database_alerts(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"db:alerts:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    await _set_timeout(db)

    # Find DB container IDs
    conditions = [Container.image.ilike(f"%{kw}%") for kw in DB_KEYWORDS]
    containers_q = await db.execute(
        select(Container.id, Container.name).where(or_(*conditions))
    )
    db_containers = {c.id: c.name.lstrip("/") for c in containers_q.all()}

    # Fetch recent alerts (DB container alerts + server-level alerts as fallback)
    if db_containers:
        cids = list(db_containers.keys())
        alerts_q = await db.execute(
            select(Alert)
            .where(or_(
                Alert.container_db_id.in_(cids),
                Alert.container_db_id.is_(None),
            ))
            .order_by(Alert.fired_at.desc())
            .limit(limit)
        )
    else:
        alerts_q = await db.execute(
            select(Alert).order_by(Alert.fired_at.desc()).limit(limit)
        )

    result = []
    for a in alerts_q.scalars().all():
        container_name = db_containers.get(a.container_db_id) if a.container_db_id else None
        result.append({
            "id":             str(a.id),
            "severity":       a.severity,
            "title":          a.title,
            "message":        a.message,
            "status":         a.status,
            "container_name": container_name,
            "metric_name":    a.metric_name,
            "current_value":  a.current_value,
            "threshold":      a.threshold,
            "fired_at":       a.fired_at.isoformat() if a.fired_at else None,
            "resolved_at":    a.resolved_at.isoformat() if a.resolved_at else None,
        })

    resp = {
        "alerts": result,
        "total": len(result),
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }
    await cache_set(cache_key, json.dumps(resp), ttl=CACHE_TTL["alerts"])
    return resp


# ─────────────────────────────────────────────────────────────────
# GET /databases/{container_id} — single DB detail (cached 30 s)
# ─────────────────────────────────────────────────────────────────
@router.get("/databases/{container_id}")
async def get_database_detail(
    container_id: str,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    from sqlalchemy import String

    cache_key = f"db:detail:{container_id}"
    cached = await cache_get(cache_key)
    if cached:
        return json.loads(cached)

    await _set_timeout(db)

    q = await db.execute(
        select(Container)
        .options(joinedload(Container.server))
        .where(Container.id.cast(String) == container_id)
    )
    c = q.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Database container not found")

    base = container_to_db_item(c)

    # Get last 30 metric points for sparkline (from our own metrics table)
    metrics_q = await db.execute(
        select(ContainerMetric)
        .where(ContainerMetric.container_db_id == c.id)
        .order_by(ContainerMetric.time.desc())
        .limit(30)
    )
    raw_metrics = metrics_q.scalars().all()
    sparkline = [
        {
            "time": m.time.isoformat(),
            "cpu":  round(m.cpu_percent or 0, 2),
            "mem":  round(m.mem_percent or 0, 2),
        }
        for m in reversed(raw_metrics)
    ]

    # Recent alerts for this container
    alerts_q = await db.execute(
        select(Alert)
        .where(Alert.container_db_id == c.id)
        .order_by(Alert.fired_at.desc())
        .limit(5)
    )
    recent_alerts = [
        {
            "severity":  a.severity,
            "title":     a.title,
            "message":   a.message,
            "status":    a.status,
            "fired_at":  a.fired_at.isoformat() if a.fired_at else None,
        }
        for a in alerts_q.scalars().all()
    ]

    resp = {
        **base,
        "sparkline":                sparkline,
        "recent_alerts":            recent_alerts,
        "credentials_configured":   False,
        "engine_telemetry_available": False,
        "collected_at":             datetime.now(timezone.utc).isoformat(),
        "safety_note":              (
            "All data sourced from Docker stats collector stored in DevOps Monitor DB. "
            "Zero queries executed against the monitored database engine."
        ),
    }
    await cache_set(cache_key, json.dumps(resp), ttl=CACHE_TTL["detail"])
    return resp
