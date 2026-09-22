from datetime import datetime, timedelta, timezone
import structlog
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy import select, func, desc, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
import json
import time

from app.database import get_db, AsyncSessionLocal
from app.models.server import Server
from app.models.alert import Alert
from app.models.metric import DiskMetric
from app.services.ssh_client import SSHClient
from app.services.credential_vault import get_server_credentials
from app.redis_client import cache_get, cache_set, get_redis

log = structlog.get_logger()
router = APIRouter(prefix="/storage", tags=["Storage"])

_PERIOD_SECONDS = {
    '5m':  5 * 60,
    '15m': 15 * 60,
    '1h':  3600,
    '6h':  6 * 3600,
    '24h': 24 * 3600,
    '7d':  7 * 24 * 3600,
}

def parse_size(size_str: str) -> float:
    # helper for SSH outputs like 10G, 500M
    size_str = size_str.upper().strip()
    if size_str.endswith('T') or size_str.endswith('TB'):
        return float(size_str.replace('T', '').replace('B', '').strip()) * 1024 * 1024 * 1024 * 1024
    if size_str.endswith('G') or size_str.endswith('GB'):
        return float(size_str.replace('G', '').replace('B', '').strip()) * 1024 * 1024 * 1024
    if size_str.endswith('M') or size_str.endswith('MB'):
        return float(size_str.replace('M', '').replace('B', '').strip()) * 1024 * 1024
    if size_str.endswith('K') or size_str.endswith('KB'):
        return float(size_str.replace('K', '').replace('B', '').strip()) * 1024
    try:
        return float(size_str)
    except:
        return 0

@router.get("/dashboard")
async def get_storage_dashboard(
    period: str = '1h',
    environment: str = 'all',
    server_id: str = 'all',
    filesystem: str = 'all',
    db: AsyncSession = Depends(get_db),
):
    now_utc = datetime.now(timezone.utc)
    
    # Servers
    server_q = select(Server).where(Server.is_active == True)
    if environment and environment.lower() not in ('all', 'all environments', ''):
        server_q = server_q.where(func.lower(Server.environment) == environment.lower())
        
    all_servers = (await db.execute(server_q)).scalars().all()
    server_map = {str(s.id): s for s in all_servers}
    
    target_servers = all_servers
    if server_id != 'all':
        target_servers = [s for s in all_servers if str(s.id) == server_id]

    target_ids = [s.id for s in target_servers]
    
    # Latest Disks from DB
    latest_disks_q = select(DiskMetric).where(DiskMetric.server_id.in_(target_ids)).order_by(DiskMetric.server_id, DiskMetric.mount_point, desc(DiskMetric.time))
    all_disks = (await db.execute(latest_disks_q)).scalars().all()
    
    # deduplicate to get only the latest per mount point per server
    current_disks = {}
    for d in all_disks:
        key = (str(d.server_id), d.mount_point)
        if key not in current_disks:
            current_disks[key] = d
            
    filtered_disks = list(current_disks.values())
    if filesystem != 'all':
        filtered_disks = [d for d in filtered_disks if d.mount_point == filesystem or d.filesystem == filesystem]
        
    total_capacity = sum([d.total_bytes for d in filtered_disks if d.total_bytes])
    used_capacity = sum([d.used_bytes for d in filtered_disks if d.used_bytes])
    free_capacity = sum([d.free_bytes for d in filtered_disks if d.free_bytes])
    
    # Alerts
    alerts_q = select(Alert).where(Alert.status == 'active', Alert.server_id.in_(target_ids), Alert.metric_name.ilike('%disk%'))
    active_alerts = (await db.execute(alerts_q)).scalars().all()
    
    # Top Disks (hot volumes)
    hot_volumes = sum(1 for d in filtered_disks if d.use_percent and d.use_percent > 85)
    
    # Capacity Trend
    period_seconds = _PERIOD_SECONDS.get(period, 3600)
    history_start = now_utc - timedelta(seconds=period_seconds)
    bucket_seconds = max(60, period_seconds // 60)
    
    trend_q = select(DiskMetric).where(DiskMetric.server_id.in_(target_ids), DiskMetric.time >= history_start)
    if filesystem != 'all':
        trend_q = trend_q.where((DiskMetric.mount_point == filesystem) | (DiskMetric.filesystem == filesystem))
    
    trend_rows = (await db.execute(trend_q)).scalars().all()
    
    buckets = {}
    for row in trend_rows:
        ts = int(row.time.timestamp())
        bts = (ts // bucket_seconds) * bucket_seconds
        if bts not in buckets:
            buckets[bts] = {}
        key = (str(row.server_id), row.mount_point)
        if key not in buckets[bts]:
            buckets[bts][key] = {"used": row.used_bytes or 0, "free": row.free_bytes or 0}
            
    history = []
    for bts in sorted(buckets.keys()):
        used_sum = sum(v["used"] for v in buckets[bts].values())
        free_sum = sum(v["free"] for v in buckets[bts].values())
        history.append({
            "time": datetime.fromtimestamp(bts, tz=timezone.utc).isoformat(),
            "used": used_sum,
            "free": free_sum
        })

    # Health Table
    server_rows = []
    for d in filtered_disks:
        srv = server_map.get(str(d.server_id))
        if not srv: continue
        
        status = "Healthy"
        if d.use_percent:
            if d.use_percent > 90:
                status = "Critical"
            elif d.use_percent > 80:
                status = "Warning"
                
        is_stale = False
        if d.time:
            # Handle both tz-aware and tz-naive datetimes from DB
            d_time = d.time if d.time.tzinfo is not None else d.time.replace(tzinfo=timezone.utc)
            age = (now_utc - d_time).total_seconds()
            if age > 600:
                is_stale = True
                
        server_rows.append({
            "server_id": str(srv.id),
            "server_name": srv.name,
            "mount_path": d.mount_point,
            "filesystem": d.filesystem or "unknown",
            "total": d.total_bytes or 0,
            "used": d.used_bytes or 0,
            "free": d.free_bytes or 0,
            "use_percent": d.use_percent or 0,
            "inodes_percent": d.inode_percent or 0,
            "read_s": 0, # Could be added later
            "write_s": 0,
            "status": status,
            "is_stale": is_stale,
            "last_seen": d.time.isoformat() if d.time else None
        })
        
    # SSH live calls for specific server/fs if selected
    top_consumers = []
    explorer = []
    
    if server_id != 'all' and filesystem != 'all' and len(target_servers) == 1:
        # Live fetch for top consumers and explorer
        srv = target_servers[0]
        try:
            creds = await get_server_credentials(str(srv.id), db)
            client = SSHClient(
                host=srv.ip_address,
                port=srv.ssh_port,
                username=creds["username"],
                password=creds.get("password"),
                private_key=creds.get("private_key")
            )
            await client.connect()
            
            # Explorer (ls) - Fast
            try:
                cmd_ls = f"ls -lA --time-style=iso '{filesystem}'"
                ls_out, _, code2 = await client._run_command_full(cmd_ls, timeout=8, use_sudo=True)
                if code2 in (0, 1) and ls_out:
                    for line in ls_out.strip().split("\n"):
                        if line.startswith("total"): continue
                        parts = line.split(None, 7)
                        if len(parts) >= 8:
                            perms = parts[0]
                            size = parts[4]
                            mod_date = parts[5] + " " + parts[6]
                            name = parts[7]
                            
                            f_type = "Folder" if perms.startswith('d') else "File"
                            size_b = int(size) if size.isdigit() else 0
                            
                            explorer.append({
                                "name": name,
                                "type": f_type,
                                "size": size_b,
                                "modified": mod_date,
                                "growth": None,
                                "depth": 1
                            })
            except Exception as e:
                log.error("storage_ls_fetch_error", error=str(e))
            
            await client.disconnect()
        except Exception as e:
            log.error("storage_ssh_connect_error", error=str(e))

    # Fast Growth (dummy logic since history per folder isn't stored in DB)
    fastest_growth = []

    # Recent Alerts
    recent_alerts_q = select(Alert).where(Alert.metric_name.ilike('%disk%')).order_by(desc(Alert.fired_at)).limit(10)
    recent_alerts = (await db.execute(recent_alerts_q)).scalars().all()
    
    formatted_alerts = []
    for a in recent_alerts:
        _srv_obj = server_map.get(str(a.server_id))
        formatted_alerts.append({
            "time": a.fired_at.isoformat() if a.fired_at else None,
            "server_name": _srv_obj.name if _srv_obj else "Unknown",
            "mount_path": "multiple",
            "message": a.title or a.message,
            "severity": a.severity
        })

    return {
        "summary": {
            "reporting_servers": len(set(d.server_id for d in filtered_disks)),
            "total_servers": len(target_servers),
            "mounted_filesystems": len(filtered_disks),
            "used_capacity": used_capacity,
            "total_capacity": total_capacity,
            "free_capacity": free_capacity,
            "disk_alerts": len(active_alerts),
            "hot_volumes": hot_volumes
        },
        "capacity_trend": history,
        "filesystem_health": server_rows,
        "top_consumers": top_consumers,
        "explorer": explorer,
        "fastest_growth": fastest_growth,
        "recent_alerts": formatted_alerts
    }

async def _run_background_du_scan(server_id: str, filesystem: str):
    lock_key = f"storage:du:lock:{server_id}:{filesystem}"
    cache_key = f"storage:du:{server_id}:{filesystem}"
    client = await get_redis()
    if not await client.set(lock_key, "locked", nx=True, ex=600):
        return
    try:
        async with AsyncSessionLocal() as db:
            server_q = select(Server).where(Server.id == server_id, Server.is_active == True)
            srv = (await db.execute(server_q)).scalar_one_or_none()
            if not srv: return
            creds = await get_server_credentials(str(srv.id), db)
            
        ssh = SSHClient(
            host=srv.ip_address, port=srv.ssh_port,
            username=creds["username"], password=creds.get("password"), private_key=creds.get("private_key")
        )
        await ssh.connect()
        cmd_du = f"du -xb --exclude='*/overlay2/*' --exclude='*/containers/*' --max-depth=1 '{filesystem}'"
        du_out, _, code = await ssh._run_command_full(cmd_du, timeout=600, use_sudo=True)
        await ssh.disconnect()
        
        if code in (0, 1) and du_out:
            cache_data = {}
            for line in du_out.strip().split("\n"):
                parts = line.split(None, 1)
                if len(parts) == 2:
                    cache_data[parts[1]] = int(parts[0])
            await cache_set(cache_key, json.dumps({
                "sizes": cache_data,
                "updated_at": int(time.time())
            }), ttl=86400)
    except Exception as e:
        log.error("bg_du_scan_error", error=str(e))
    finally:
        await client.delete(lock_key)


@router.get("/consumers")
async def get_top_consumers(
    bg_tasks: BackgroundTasks,
    server_id: str = 'all',
    filesystem: str = 'all',
    db: AsyncSession = Depends(get_db)
):
    if server_id == 'all':
        return {"top_consumers": [], "status": "complete"}

    if filesystem == 'all' or not filesystem:
        latest_disks_q = select(DiskMetric).where(DiskMetric.server_id == server_id).order_by(DiskMetric.mount_point, desc(DiskMetric.time))
        all_disks = (await db.execute(latest_disks_q)).scalars().all()
        current_disks = {}
        for d in all_disks:
            if d.mount_point not in current_disks:
                current_disks[d.mount_point] = d
                
        consumers = []
        rank = 1
        for mp, d in current_disks.items():
            consumers.append({
                "path": mp,
                "type": "directory",
                "size_bytes": d.used_bytes,
                "use_percent": d.use_percent,
                "rank": rank
            })
            rank += 1
        return {"top_consumers": consumers, "status": "complete", "refreshing": False}

    server_q = select(Server).where(Server.id == server_id, Server.is_active == True)
    srv = (await db.execute(server_q)).scalar_one_or_none()
    if not srv: return {"top_consumers": [], "status": "complete"}

    try:
        creds = await get_server_credentials(str(srv.id), db)
        client = SSHClient(
            host=srv.ip_address, port=srv.ssh_port,
            username=creds["username"], password=creds.get("password"), private_key=creds.get("private_key")
        )
        await client.connect()
        
        # Live directory inventory & exact filesystem capacity
        cmd_stat = f"find '{filesystem}' -maxdepth 1 -exec stat -c '%s|%F|%n' {{}} + 2>/dev/null"
        cmd_df = f"df -B1 '{filesystem}' | tail -n 1"
        
        stat_out, _, stat_code = await client._run_command_full(cmd_stat, timeout=10, use_sudo=True)
        df_out, _, df_code = await client._run_command_full(cmd_df, timeout=5, use_sudo=True)
        await client.disconnect()
        
        total_fs_size = 1
        if df_code == 0 and df_out:
            df_parts = df_out.strip().split()
            if len(df_parts) >= 2:
                try: total_fs_size = int(df_parts[1])
                except: pass
                
        items_meta = {}
        if stat_code in (0, 1, 123) and stat_out:
            for line in stat_out.strip().split("\n"):
                parts = line.split("|", 2)
                if len(parts) == 3:
                    size_b, file_type, path = parts
                    items_meta[path] = {
                        "live_size": int(size_b),
                        "type": "directory" if "directory" in file_type.lower() else "file"
                    }
                    
        # Remove the root path from children
        if filesystem in items_meta:
            del items_meta[filesystem]
            
        cache_key = f"storage:du:{server_id}:{filesystem}"
        cached = await cache_get(cache_key)
        
        du_sizes = {}
        updated_at = None
        needs_refresh = True
        if cached:
            data = json.loads(cached)
            du_sizes = data.get("sizes", {})
            updated_at = data.get("updated_at")
            if updated_at and (int(time.time()) - updated_at) < 3600:
                needs_refresh = False
                
        if needs_refresh:
            bg_tasks.add_task(_run_background_du_scan, server_id, filesystem)
            
        top_consumers = []
        for path, meta in items_meta.items():
            t = meta["type"]
            size_b = None
            if t == "directory":
                if path in du_sizes:
                    size_b = du_sizes[path]
            else:
                size_b = meta["live_size"]
                
            top_consumers.append({
                "path": path,
                "type": t,
                "size_bytes": size_b,
                "use_percent": round((size_b / total_fs_size) * 100, 1) if size_b and total_fs_size else 0
            })
            
        # Sort by size descending, put None at bottom
        top_consumers.sort(key=lambda x: (x["size_bytes"] is not None, x["size_bytes"] or 0), reverse=True)
        for idx, item in enumerate(top_consumers[:100]):
            item["rank"] = idx + 1
            
        return {
            "top_consumers": top_consumers[:100],
            "status": "complete",
            "refreshing": needs_refresh,
            "updated_at": updated_at
        }
    except Exception as e:
        log.error("storage_consumers_fetch_error", error=str(e))
        return {"top_consumers": [], "status": "failed"}
