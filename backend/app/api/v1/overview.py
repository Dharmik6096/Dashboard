"""
Overview Dashboard API — returns a single coherent snapshot.

All values come from PostgreSQL (ServerMetric, Server, Container, Alert,
InfrastructureEvent) populated by the SSH/agent ingester. No mock data.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.server import Server
from app.models.container import Container
from app.models.alert import Alert
from app.models.infrastructure_event import InfrastructureEvent
from app.models.metric import ServerMetric
from app.redis_client import get_redis

router = APIRouter(prefix='/overview', tags=['Overview'])

_PERIOD_SECONDS: dict[str, int] = {
    '5m':  5 * 60,
    '15m': 15 * 60,
    '1h':  3600,
    '6h':  6 * 3600,
    '24h': 24 * 3600,
    '7d':  7 * 24 * 3600,
}
_DESIRED_POINTS = 60


@router.get('/dashboard')
async def get_overview_dashboard(
    period: str = '1h',
    env: str = 'all',
    server_id: str = 'all',
    db: AsyncSession = Depends(get_db),
):
    now_utc = datetime.now(timezone.utc)

    # ── 1. Servers ────────────────────────────────────────────────────────────
    base_server_query = select(Server).where(Server.is_active == True)
    if env != 'all':
        base_server_query = base_server_query.where(func.lower(Server.environment) == env.lower())
        
    dropdown_servers_res = await db.execute(base_server_query)
    dropdown_servers = dropdown_servers_res.scalars().all()

    if server_id != 'all':
        server_query = base_server_query.where(Server.id == server_id)
    else:
        server_query = base_server_query

    servers_res = await db.execute(server_query)
    servers = servers_res.scalars().all()
    server_ids = [s.id for s in servers]
    server_name_by_id: dict = {s.id: s.name for s in servers}
    server_obj_by_id: dict = {s.id: s for s in servers}

    total_servers = len(servers)
    online_servers = [s for s in servers if s.status == 'online']
    online_count = len(online_servers)
    online_ids = [s.id for s in online_servers]

    # ── 2. Containers ─────────────────────────────────────────────────────────
    if server_ids:
        containers_res = await db.execute(
            select(Container).where(Container.server_id.in_(server_ids))
        )
    else:
        containers_res = await db.execute(select(Container).where(False))
    containers = containers_res.scalars().all()

    total_containers = len(containers)
    running_containers = sum(1 for c in containers if c.status == 'running')

    cont_count_by_server: dict[str, int] = {}
    for c in containers:
        sid = str(c.server_id)
        cont_count_by_server[sid] = cont_count_by_server.get(sid, 0) + 1

    # ── 3. Active Alerts ──────────────────────────────────────────────────────
    if server_ids:
        alerts_res = await db.execute(
            select(Alert).where(Alert.status == 'active', Alert.server_id.in_(server_ids))
        )
    else:
        alerts_res = await db.execute(select(Alert).where(False))
    active_alerts = alerts_res.scalars().all()

    total_alerts = len(active_alerts)
    critical_alerts = sum(1 for a in active_alerts if a.severity == 'critical')

    alert_count_by_server: dict[str, int] = {}
    for a in active_alerts:
        if a.server_id:
            sid = str(a.server_id)
            alert_count_by_server[sid] = alert_count_by_server.get(sid, 0) + 1

    # ── 4. Averages — exclude None ───────────────────────
    valid_cpu  = [s.last_cpu_percent  for s in servers if s.last_cpu_percent  is not None]
    valid_ram  = [s.last_ram_percent  for s in servers if s.last_ram_percent  is not None]
    valid_disk = [s.last_disk_percent for s in servers if s.last_disk_percent is not None]

    avg_cpu  = sum(valid_cpu)  / len(valid_cpu)  if valid_cpu  else None
    avg_ram  = sum(valid_ram)  / len(valid_ram)  if valid_ram  else None
    avg_disk = sum(valid_disk) / len(valid_disk) if valid_disk else None

    # ── 5. Top Consumers ──────────────────────────────────────────────────────
    active_monitored_servers = [s for s in servers if s.status != 'offline']
    top_cpu_servers = sorted(
        active_monitored_servers, key=lambda s: s.last_cpu_percent or 0, reverse=True
    )[:5]
    top_ram_servers = sorted(
        active_monitored_servers, key=lambda s: s.last_ram_percent or 0, reverse=True
    )[:5]
    running_conts = [c for c in containers if c.status and c.status.lower() == 'running']
    top_cpu_containers = sorted(
        running_conts, key=lambda c: c.last_cpu_percent or 0, reverse=True
    )[:5]
    top_ram_containers = sorted(
        running_conts,
        key=lambda c: (c.last_mem_usage / c.last_mem_limit * 100)
        if (c.last_mem_limit and c.last_mem_usage)
        else 0,
        reverse=True,
    )[:5]

    # ── 6. Recent Alerts (deduplicated by rule+server+container) ─────────────
    if server_ids:
        recent_alerts_res = await db.execute(
            select(Alert)
            .where(Alert.server_id.in_(server_ids))
            .order_by(desc(Alert.fired_at))
            .limit(50)
        )
    else:
        recent_alerts_res = await db.execute(select(Alert).where(False))

    raw_alerts = recent_alerts_res.scalars().all()
    seen_keys: set = set()
    recent_alerts = []
    for a in raw_alerts:
        key = (a.rule_id, a.server_id, a.container_db_id)
        if key not in seen_keys:
            seen_keys.add(key)
            recent_alerts.append(a)
            if len(recent_alerts) >= 10:
                break

    period_seconds = _PERIOD_SECONDS.get(period, 3600)
    history_start = now_utc - timedelta(seconds=period_seconds)
    bucket_seconds = max(30, period_seconds // _DESIRED_POINTS)

    # ── 7. Recent Events ──────────────────────────────────────────────────────
    from app.models.container import ContainerEvent
    recent_events_combined = []
    
    if server_ids:
        recent_infra_res = await db.execute(
            select(InfrastructureEvent)
            .where(
                InfrastructureEvent.server_id.in_(server_ids),
                InfrastructureEvent.created_at >= history_start
            )
            .order_by(desc(InfrastructureEvent.created_at))
            .limit(15)
        )
        recent_cont_res = await db.execute(
            select(ContainerEvent)
            .where(
                ContainerEvent.server_id.in_(server_ids),
                ContainerEvent.occurred_at >= history_start
            )
            .order_by(desc(ContainerEvent.occurred_at))
            .limit(15)
        )
        
        infra_events = recent_infra_res.scalars().all()
        cont_events = recent_cont_res.scalars().all()
        
        for e in infra_events:
            recent_events_combined.append({
                'id': str(e.id),
                'time': e.created_at,
                'server_id': e.server_id,
                'source': e.source,
                'event': e.title,
                'severity': e.severity,
                'event_type': e.event_type,
            })
            
        for e in cont_events:
            severity = "info"
            if "exited" in e.event_type.lower() or e.oom_killed: severity = "error"
            recent_events_combined.append({
                'id': str(e.id),
                'time': e.occurred_at,
                'server_id': e.server_id,
                'source': "container",
                'event': f"Container {e.container_name} {e.event_type.replace('container_', '')}",
                'severity': severity,
                'event_type': e.event_type,
            })
            
        recent_events_combined.sort(key=lambda x: x['time'], reverse=True)
        recent_events = recent_events_combined[:15]
    else:
        recent_events = []

    # ── 8. History from PostgreSQL ServerMetric ───────────────────────────────
    history: list[dict] = []

    if server_ids:
        try:
            metrics_res = await db.execute(
                select(ServerMetric)
                .where(
                    ServerMetric.server_id.in_(server_ids),
                    ServerMetric.time >= history_start,
                )
                .order_by(ServerMetric.time)
            )
            metric_rows = metrics_res.scalars().all()

            if metric_rows:
                buckets: dict[int, dict] = {}
                for row in metric_rows:
                    row_time = row.time
                    if row_time.tzinfo is None:
                        row_time = row_time.replace(tzinfo=timezone.utc)
                    ts = int(row_time.timestamp())
                    bts = (ts // bucket_seconds) * bucket_seconds
                    if bts not in buckets:
                        buckets[bts] = {
                            'cpu': [], 'ram': [], 'load': [], 'rx': [], 'tx': []
                        }
                    b = buckets[bts]
                    if row.cpu_percent is not None:
                        b['cpu'].append(row.cpu_percent)
                    if row.ram_used is not None and row.ram_total and row.ram_total > 0:
                        b['ram'].append(row.ram_used / row.ram_total * 100)
                    if row.load_1 is not None and row.load_1 >= 0:
                        b['load'].append(row.load_1)
                    # Network rate (bytes/sec → KB/s). Cap at 1 GB/s to skip
                    # cumulative totals stored on first ingest cycle.
                    MAX_RATE_BYTES = 1_073_741_824  # 1 GB/s
                    if row.net_rx_rate is not None and 0 <= row.net_rx_rate < MAX_RATE_BYTES:
                        b['rx'].append(row.net_rx_rate / 1024)
                    if row.net_tx_rate is not None and 0 <= row.net_tx_rate < MAX_RATE_BYTES:
                        b['tx'].append(row.net_tx_rate / 1024)

                for bts in sorted(buckets.keys()):
                    b = buckets[bts]
                    pt: dict = {
                        'time': datetime.fromtimestamp(bts, tz=timezone.utc).isoformat()
                    }
                    if b['cpu']:
                        pt['cpu'] = round(sum(b['cpu']) / len(b['cpu']), 2)
                    if b['ram']:
                        pt['ram'] = round(sum(b['ram']) / len(b['ram']), 2)
                    if b['load']:
                        pt['load'] = round(sum(b['load']) / len(b['load']), 3)
                    if b['rx']:
                        # Documented: SUM RX/TX across selected servers for network rate
                        pt['rx'] = round(sum(b['rx']) if server_id == 'all' else sum(b['rx']) / len(b['rx']), 2)
                    if b['tx']:
                        pt['tx'] = round(sum(b['tx']) if server_id == 'all' else sum(b['tx']) / len(b['tx']), 2)
                    history.append(pt)
        except Exception:
            history = []

    # Inject latest live sample if it's newer than the last historical bucket
    latest_live_time = max((s.last_success_at for s in servers if s.last_success_at), default=None)
    if latest_live_time:
        latest_live_iso = latest_live_time.isoformat()
        if not history or history[-1]['time'] < latest_live_iso:
            live_pt = {'time': latest_live_iso}
            if avg_cpu is not None: live_pt['cpu'] = round(avg_cpu, 2)
            if avg_ram is not None: live_pt['ram'] = round(avg_ram, 2)
            valid_load = [s.last_load_1 for s in servers if s.last_load_1 is not None]
            if valid_load: live_pt['load'] = round(sum(valid_load)/len(valid_load), 3)
            # Cannot easily average network without previous rx_bytes, so omit rx/tx here
            if len(live_pt) > 1:
                history.append(live_pt)

    # ── 9. Per-server rows for Server Health table ────────────────────────────
    def _fmt_uptime(secs: int | None) -> str | None:
        if not secs or secs <= 0:
            return None
        days = secs // 86400
        hours = (secs % 86400) // 3600
        minutes = (secs % 3600) // 60
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"

    server_rows = []
    for s in servers:
        sid_str = str(s.id)

        # Freshness: stale if last_success_at > 3 minutes ago
        is_stale = False
        if s.last_success_at:
            age_s = (now_utc - s.last_success_at.replace(tzinfo=timezone.utc)
                     if s.last_success_at.tzinfo is None
                     else now_utc - s.last_success_at).total_seconds()
            is_stale = age_s > 180
        server_rows.append({
            'id': sid_str,
            'name': s.name,
            'ip_address': s.ip_address,
            'environment': s.environment,
            'status': s.status,
            'is_stale': is_stale,
            'last_cpu_percent': s.last_cpu_percent,
            'last_ram_percent': s.last_ram_percent,
            'last_disk_percent': s.last_disk_percent,
            'load_avg': s.last_load_1,
            'container_count': cont_count_by_server.get(sid_str),
            'alert_count': alert_count_by_server.get(sid_str, 0),
            'uptime': _fmt_uptime(getattr(s, 'last_uptime_seconds', None)),
            'last_seen': s.last_success_at.isoformat() if s.last_success_at else (
                s.last_seen.isoformat() if s.last_seen else None
            ),
        })

    # ── 10. Backend health ────────────────────────────────────────────────────
    backend_health = await _check_backend_health(db)

    return {
        'generated_at': now_utc.isoformat(),
        'stats': {
            'servers': total_servers,
            'servers_online': online_count,
            'containers': total_containers,
            'containers_running': running_containers,
            'alerts': total_alerts,
            'alerts_critical': critical_alerts,
            'avg_cpu': round(avg_cpu, 1) if avg_cpu is not None else None,
            'avg_ram': round(avg_ram, 1) if avg_ram is not None else None,
            'avg_disk': round(avg_disk, 1) if avg_disk is not None else None,
        },
        'top_consumers': {
            'cpu_servers': [
                {'id': str(s.id), 'name': s.name, 'value': s.last_cpu_percent or 0}
                for s in top_cpu_servers
            ],
            'ram_servers': [
                {'id': str(s.id), 'name': s.name, 'value': s.last_ram_percent or 0}
                for s in top_ram_servers
            ],
            'cpu_containers': [
                {
                    'id': str(c.id),
                    'name': c.name,
                    'server_name': server_obj_by_id[c.server_id].name
                    if c.server_id in server_obj_by_id else 'Unknown',
                    'image': c.image,
                    'status': c.status,
                    'value': c.last_cpu_percent or 0,
                }
                for c in top_cpu_containers
            ],
            'ram_containers': [
                {
                    'id': str(c.id),
                    'name': c.name,
                    'server_name': server_obj_by_id[c.server_id].name
                    if c.server_id in server_obj_by_id else 'Unknown',
                    'image': c.image,
                    'status': c.status,
                    'value': round(
                        c.last_mem_usage / c.last_mem_limit * 100, 1
                    ) if (c.last_mem_limit and c.last_mem_usage) else 0,
                    'mem_mb': round(c.last_mem_usage / 1_048_576, 1)
                    if c.last_mem_usage else 0,
                }
                for c in top_ram_containers
            ],
        },
        'recent_alerts': [
            {
                'id': str(a.id),
                'severity': a.severity,
                'server_name': server_name_by_id.get(a.server_id, 'Unknown') if a.server_id else 'Unknown',
                'target': server_name_by_id.get(a.server_id, 'Unknown') if a.server_id else 'Unknown',
                'metric': a.metric_name or '',
                'alert': a.title or 'Unknown',
                'message': a.message or '',
                'current_value': a.current_value,
                'threshold': a.threshold,
                'status': a.status,
                'created_at': a.fired_at.isoformat() if a.fired_at else None,
                'resolved_at': a.resolved_at.isoformat() if a.resolved_at else None,
            }
            for a in recent_alerts
        ],
        'recent_events': [
            {
                'id': e['id'],
                'time': e['time'].isoformat() if e['time'] else None,
                'server_name': server_name_by_id.get(e['server_id'], 'Unknown'),
                'source': e['source'],
                'event': e['event'],
                'severity': e['severity'],
                'event_type': e['event_type'],
            }
            for e in recent_events
        ],
        'filter_servers': [
            {'id': str(s.id), 'name': s.name} for s in dropdown_servers
        ],
        'server_rows': server_rows,
        'history': history,
        'backend_health': backend_health,
        'meta': {
            'period': period,
            'bucket_seconds': bucket_seconds,
            'history_points': len(history),
            'history_source': 'postgresql_server_metrics',
        },
    }


async def _check_backend_health(db: AsyncSession) -> dict:
    """Real health checks — no hardcoded values."""
    import time
    
    # PostgreSQL
    pg_ok = False
    pg_latency_ms = 0
    try:
        start_t = time.perf_counter()
        await db.execute(text('SELECT 1'))
        pg_latency_ms = int((time.perf_counter() - start_t) * 1000)
        pg_ok = True
    except Exception:
        pg_ok = False

    # Redis
    redis_ok = False
    redis_latency_ms = 0
    try:
        r = await get_redis()
        start_t = time.perf_counter()
        pong = await r.ping()
        redis_latency_ms = int((time.perf_counter() - start_t) * 1000)
        redis_ok = bool(pong)
    except Exception:
        redis_ok = False

    # SSH Poller / Ingester heartbeat — check if any server was collected recently (< 90s)
    ssh_ok = False
    ssh_status = 'UNKNOWN'
    servers_ok = 0
    servers_fail = 0
    last_cycle_at = None
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=90)
        res = await db.execute(
            select(Server.status, Server.last_success_at)
            .where(Server.is_active == True)
        )
        rows = res.all()
        for status, last_at in rows:
            if last_at:
                la = last_at.replace(tzinfo=timezone.utc) if last_at.tzinfo is None else last_at
                if la >= cutoff:
                    servers_ok += 1
                    if last_cycle_at is None or la > last_cycle_at:
                        last_cycle_at = la
                else:
                    servers_fail += 1
            else:
                servers_fail += 1
        ssh_ok = servers_ok > 0
        
        if rows:
            if servers_fail == 0 and servers_ok > 0:
                ssh_status = 'HEALTHY'
            elif servers_ok > 0:
                ssh_status = 'DEGRADED'
            elif last_cycle_at and last_cycle_at < (datetime.now(timezone.utc) - timedelta(minutes=5)):
                ssh_status = 'STALE'
            else:
                ssh_status = 'DOWN'
        else:
            ssh_status = 'UNKNOWN'
    except Exception:
        ssh_status = 'DOWN'

    # Docker Discovery
    docker_ok = False
    docker_status = 'UNKNOWN'
    try:
        res = await db.execute(
            select(func.count(Server.id))
            .where(Server.is_active == True, Server.docker_status == 'AVAILABLE')
        )
        docker_count = (res.scalar_one() or 0)
        if docker_count > 0:
            docker_ok = True
            docker_status = 'HEALTHY'
        else:
            docker_status = 'LIMITED'
    except Exception:
        docker_status = 'DOWN'

    all_ok = pg_ok and redis_ok and ssh_ok
    
    overall = "Platform Healthy"
    if not pg_ok or not redis_ok:
        overall = "Critical Backend Failure"
    elif ssh_status in ['DEGRADED', 'STALE', 'DOWN']:
        overall = "Monitoring Degraded"

    return {
        'api': {'status': 'HEALTHY'},
        'postgres': {'status': 'HEALTHY' if pg_ok else 'DOWN', 'latency_ms': pg_latency_ms},
        'redis': {'status': 'HEALTHY' if redis_ok else 'DOWN', 'latency_ms': redis_latency_ms},
        'ssh_poller': {
            'status': ssh_status,
            'servers_ok': servers_ok,
            'servers_fail': servers_fail,
            'last_cycle_at': last_cycle_at.isoformat() if last_cycle_at else None,
        },
        'docker_discovery': {'status': docker_status},
        'all_ok': all_ok,
        'overall': overall,
    }
