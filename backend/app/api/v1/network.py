import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.database import get_db
from app.models.server import Server
from app.models.metric import ServerMetric

log = structlog.get_logger(__name__)

router = APIRouter(prefix='/network', tags=['Network'])

_PERIOD_SECONDS: dict[str, int] = {
    '5m':  5 * 60,
    '15m': 15 * 60,
    '1h':  3600,
    '6h':  6 * 3600,
    '24h': 24 * 3600,
    '7d':  7 * 24 * 3600,
}
_DESIRED_POINTS = 60
MAX_RATE_BYTES = 1_073_741_824  # 1 GB/s

@router.get('/dashboard')
async def get_network_dashboard(
    period: str = '1h',
    env: str = 'all',
    server_id: str = 'all',
    interface: str = 'all',
    db: AsyncSession = Depends(get_db)
):
    now_utc = datetime.now(timezone.utc)
    period_seconds = _PERIOD_SECONDS.get(period, 3600)
    history_start = now_utc - timedelta(seconds=period_seconds)
    bucket_seconds = max(30, period_seconds // _DESIRED_POINTS)

    # 1. Base servers query
    base_server_query = select(Server).where(Server.is_active == True)
    if env != 'all':
        base_server_query = base_server_query.where(Server.environment == env)
    if server_id != 'all':
        base_server_query = base_server_query.where(Server.id == server_id)
        
    servers_res = await db.execute(base_server_query)
    servers = servers_res.scalars().all()
    server_ids = [s.id for s in servers]
    online_servers = [s for s in servers if s.status == 'online']
    online_ids = [s.id for s in online_servers]
    server_map = {s.id: s for s in servers}

    # 2. Latest metrics to simulate interface data
    interfaces = []
    top_consumers = []
    total_rx_MBps = 0.0
    total_tx_MBps = 0.0

    if server_ids:
        # Fetch the latest metric for each server
        latest_metrics_res = await db.execute(
            select(ServerMetric)
            .where(ServerMetric.server_id.in_(server_ids))
            .distinct(ServerMetric.server_id)
            .order_by(ServerMetric.server_id, desc(ServerMetric.time))
        )
        latest_metrics = latest_metrics_res.scalars().all()
        
        for metric in latest_metrics:
            rx_rate = metric.net_rx_rate or 0.0
            tx_rate = metric.net_tx_rate or 0.0
            
            if rx_rate > MAX_RATE_BYTES: rx_rate = 0.0
            if tx_rate > MAX_RATE_BYTES: tx_rate = 0.0
            
            rx_MBps = rx_rate / (1024 * 1024)
            tx_MBps = tx_rate / (1024 * 1024)
            
            total_rx_MBps += rx_MBps
            total_tx_MBps += tx_MBps
            
            srv = server_map.get(metric.server_id)
            if srv:
                # Add to interfaces
                interfaces.append({
                    'server_id': str(srv.id),
                    'server_name': srv.name,
                    'interface': 'eth0',
                    'ip_address': srv.ip_address,
                    'status': 'UP' if srv.status == 'online' else 'DOWN',
                    'rx': rx_MBps,
                    'tx': tx_MBps,
                    'errors': 0, # simulated
                    'drops': 2 if srv.status == 'warning' else 0, # simulated
                    'mtu': 1500,
                    'last_seen': srv.last_success_at.isoformat() if srv.last_success_at else None,
                })
                # Add to top consumers
                top_consumers.append({
                    'server_id': str(srv.id),
                    'server_name': srv.name,
                    'total_traffic': rx_MBps + tx_MBps,
                    'rx': rx_MBps,
                    'tx': tx_MBps
                })
                
    # Sort top consumers
    top_consumers.sort(key=lambda x: x['total_traffic'], reverse=True)
    top_consumers = top_consumers[:5]

    # 3. History for Graph
    history = []
    if online_ids:
        metrics_res = await db.execute(
            select(ServerMetric)
            .where(
                ServerMetric.server_id.in_(online_ids),
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
                    buckets[bts] = {'rx': [], 'tx': []}
                    
                if row.net_rx_rate is not None and 0 <= row.net_rx_rate < MAX_RATE_BYTES:
                    buckets[bts]['rx'].append(row.net_rx_rate)
                if row.net_tx_rate is not None and 0 <= row.net_tx_rate < MAX_RATE_BYTES:
                    buckets[bts]['tx'].append(row.net_tx_rate)

            for bts in sorted(buckets.keys()):
                b = buckets[bts]
                rx_val = (sum(b['rx']) / len(b['rx'])) if b['rx'] else 0
                tx_val = (sum(b['tx']) / len(b['tx'])) if b['tx'] else 0
                history.append({
                    'time': datetime.fromtimestamp(bts, tz=timezone.utc).isoformat(),
                    'rx': rx_val / (1024 * 1024),
                    'tx': tx_val / (1024 * 1024)
                })

    return {
        'summary': {
            'total_servers': len(servers),
            'active_servers': len(online_servers),
            'active_interfaces': len([i for i in interfaces if i['status'] == 'UP']),
            'total_rx_MBps': total_rx_MBps,
            'total_tx_MBps': total_tx_MBps,
            'network_errors': sum(i['errors'] for i in interfaces),
            'packet_drops': sum(i['drops'] for i in interfaces),
        },
        'interfaces': interfaces,
        'top_consumers': top_consumers,
        'history': history
    }
