from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio
import re

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.container import Container
from app.models.server import Server
from app.models.infrastructure_event import InfrastructureEvent
from app.api.v1.docker import _get_ssh_client

router = APIRouter(prefix="/redis", tags=["redis"])

def parse_redis_info(info_str: str) -> Dict[str, Any]:
    res = {}
    for line in info_str.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        if ':' in line:
            k, v = line.split(':', 1)
            res[k.strip()] = v.strip()
    return res

def _parse_keyspace(parsed: Dict[str, Any]) -> Dict[str, Any]:
    keys = 0
    expires = 0
    for k, v in parsed.items():
        if k.startswith('db'):
            # e.g., keys=15000,expires=10,avg_ttl=12345
            parts = dict(p.split('=') for p in v.split(',') if '=' in p)
            keys += int(parts.get('keys', 0))
            expires += int(parts.get('expires', 0))
    return {"total_keys": keys, "expiring_keys": expires}

def _calculate_hit_ratio(parsed: Dict[str, Any]) -> str:
    hits = int(parsed.get('keyspace_hits', 0))
    misses = int(parsed.get('keyspace_misses', 0))
    if hits + misses == 0:
        return "—"
    return f"{(hits / (hits + misses) * 100):.1f}%"

def _format_memory(bytes_val: int) -> str:
    if bytes_val == 0: return "0 MB"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.1f} {unit}".replace('.0 ', ' ')
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} PB"
    
def _get_persistence(parsed: Dict[str, Any]) -> str:
    rdb_status = parsed.get("rdb_last_bgsave_status", "unknown")
    aof_enabled = parsed.get("aof_enabled", "0")
    
    if rdb_status == "unknown" and aof_enabled == "0":
        return "Unknown"
        
    modes = []
    if rdb_status == "ok":
        modes.append("RDB")
    if aof_enabled == "1":
        modes.append("AOF")
        
    return "+".join(modes) if modes else "None"

def _get_health_status(parsed: Dict[str, Any], state: str) -> str:
    if state.upper() != "RUNNING":
        return "Critical"
    if not parsed:
        return "Unavailable"
        
    # Check simple health rules
    if parsed.get("role") == "slave" and parsed.get("master_link_status") == "down":
        return "Critical"
        
    if parsed.get("rdb_last_bgsave_status") == "err" or parsed.get("aof_last_bgrewrite_status") == "err":
        return "Warning"
        
    frag = float(parsed.get("mem_fragmentation_ratio", 1.0))
    if frag > 1.5:
        return "Warning"
        
    if int(parsed.get("blocked_clients", 0)) > 0:
        return "Warning"
        
    return "Healthy"

@router.get("/dashboard")
async def get_redis_dashboard(
    environment: str = Query("all", description="Environment filter"),
    server_id: str = Query("all", description="Server filter"),
    redis_instance: str = Query("all", description="Redis instance filter"),
    role: str = Query("all", description="Role filter"),
    period: str = Query("1h", description="Time range for metrics"),
    search: str = Query("", description="Search term"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = Query("status", description="Sort order"),
    db: AsyncSession = Depends(get_db)
):
    # Base Query for Containers running Redis
    query = select(Container).options(joinedload(Container.server))
    
    # Simple heuristic to find Redis: image name contains 'redis'
    query = query.where(Container.image.ilike("%redis%"))
    
    if environment != "all" and environment != "All Environments":
        query = query.join(Server, Container.server_id == Server.id)
        query = query.where(func.lower(Server.environment) == environment.lower())
    elif server_id != "all" or search:
        query = query.outerjoin(Server, Container.server_id == Server.id)

    if server_id != "all" and server_id != "All Servers":
        query = query.where(Container.server_id == server_id)
        
    if redis_instance != "all" and redis_instance != "All Redis Instances":
        query = query.where(Container.name == redis_instance)
        
    if search:
        search_term = f"%{search}%"
        query = query.where(or_(
            Container.name.ilike(search_term),
            Container.container_id.ilike(search_term),
            Server.name.ilike(search_term)
        ))

    containers_result = await db.execute(query)
    containers = containers_result.scalars().all()
    
    # Collect data for all matching Redis containers
    all_instances = []
    
    # Group by server to optimize SSH connections
    server_containers = {}
    for c in containers:
        if c.server:
            server_containers.setdefault(c.server, []).append(c)
            
    # Fetch metrics concurrently per server
    async def fetch_server_redis(srv: Server, conts: List[Container]):
        ssh = await _get_ssh_client(srv, db)
        if not ssh:
            return [(c, "") for c in conts]
        res = []
        for c in conts:
            if c.status.lower() == "running":
                info_str = await ssh.docker_redis_info(c.container_id)
                res.append((c, info_str))
            else:
                res.append((c, ""))
        return res

    tasks = [fetch_server_redis(srv, conts) for srv, conts in server_containers.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    total_memory = 0
    total_keys = 0
    total_clients = 0
    total_ops = 0
    healthy_count = 0
    
    top_memory_list = []
    
    for server_result in results:
        if isinstance(server_result, Exception):
            continue
            
        for c, info_str in server_result:
            parsed = parse_redis_info(info_str) if info_str else {}
            
            status = _get_health_status(parsed, c.status)
            if status == "Healthy":
                healthy_count += 1
                
            r_role = parsed.get("role", "Unknown").capitalize()
            # If standard, role is "Master", but we want "Primary", "Replica", "Standalone"
            if r_role == "Master":
                r_role = "Primary" if int(parsed.get("connected_slaves", 0)) > 0 else "Standalone"
            elif r_role == "Slave":
                r_role = "Replica"
                
            # Role filter
            if role != "all" and role != "All Roles":
                if role.lower() != r_role.lower():
                    continue

            keyspace = _parse_keyspace(parsed)
            
            used_mem = int(parsed.get("used_memory", 0))
            max_mem = int(parsed.get("maxmemory", 0))
            
            ops = float(parsed.get("instantaneous_ops_per_sec", 0))
            clients = int(parsed.get("connected_clients", 0))
            
            if status != "Unavailable" and status != "Critical":
                total_memory += used_mem
                total_keys += keyspace["total_keys"]
                total_clients += clients
                total_ops += ops
                
            top_memory_list.append({"name": c.name, "value": used_mem, "id": str(c.id)})
            
            last_seen = c.last_seen.isoformat() if c.last_seen else None
            if status == "Unavailable" and c.status.lower() == "running":
                last_seen = "Auth Failed" if "NOAUTH" in info_str else last_seen
                
            repl_info = "Standalone"
            if r_role == "Primary":
                repl_info = f"{parsed.get('connected_slaves', 0)} replicas"
            elif r_role == "Replica":
                repl_info = f"primary: {parsed.get('master_host', 'unknown')}"

            instance = {
                "id": str(c.id),
                "server_id": str(c.server_id),
                "server_name": c.server.name if c.server else "Unknown",
                "container_id": c.container_id[:12],
                "container_name": c.name,
                "image": c.image,
                "role": r_role,
                "version": parsed.get("redis_version", "Unknown"),
                "memory_used": used_mem,
                "memory_used_human": _format_memory(used_mem),
                "max_memory": max_mem,
                "max_memory_human": _format_memory(max_mem) if max_mem > 0 else "Unlimited",
                "keys": keyspace["total_keys"],
                "clients": clients,
                "ops_sec": round(ops, 1),
                "persistence": _get_persistence(parsed),
                "replication": repl_info,
                "status": status,
                "last_seen": last_seen,
                
                # Detail Fields
                "docker_network": None,
                "port": parsed.get("tcp_port", "6379"),
                "bind": parsed.get("bind"),
                "container_state": c.status.upper(),
                "redis_status": "Healthy" if info_str else "Unavailable",
                "uptime": f"{int(parsed.get('uptime_in_days', 0))} days" if parsed.get('uptime_in_days') else "-",
                "peak_memory_human": _format_memory(int(parsed.get("used_memory_peak", 0))),
                "maxmemory_policy": parsed.get("maxmemory_policy", "noeviction"),
                "fragmentation_ratio": parsed.get("mem_fragmentation_ratio", "1.0"),
                "blocked_clients": int(parsed.get("blocked_clients", 0)),
                "expiring_keys": keyspace["expiring_keys"],
                "keyspace_hits": int(parsed.get("keyspace_hits", 0)),
                "keyspace_misses": int(parsed.get("keyspace_misses", 0)),
                "hit_ratio": _calculate_hit_ratio(parsed),
                "expired_keys": int(parsed.get("expired_keys", 0)),
                "evicted_keys": int(parsed.get("evicted_keys", 0)),
                "last_rdb_save": datetime.fromtimestamp(int(parsed.get("rdb_last_save_time", 0)), timezone.utc).isoformat() if parsed.get("rdb_last_save_time") else "-",
                "aof_enabled": "Yes" if parsed.get("aof_enabled") == "1" else "No",
                "replica_count": parsed.get("connected_slaves", 0),
                "replication_lag": "-"
            }
            all_instances.append(instance)

    # Sort
    if sort == "status":
        status_order = {"Critical": 0, "Unavailable": 1, "Warning": 2, "Healthy": 3, "Stale": 4}
        all_instances.sort(key=lambda x: (status_order.get(x["status"], 5), -x["memory_used"]))
    elif sort == "memory_desc":
        all_instances.sort(key=lambda x: x["memory_used"], reverse=True)
    elif sort == "keys_desc":
        all_instances.sort(key=lambda x: x["keys"], reverse=True)
    elif sort == "clients_desc":
        all_instances.sort(key=lambda x: x["clients"], reverse=True)
    elif sort == "ops_desc":
        all_instances.sort(key=lambda x: x["ops_sec"], reverse=True)

    # Pagination
    total = len(all_instances)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = all_instances[start:end]
    
    top_memory_list.sort(key=lambda x: x["value"], reverse=True)
    
    # Recent Events
    events_res = await db.execute(
        select(InfrastructureEvent)
        .where(InfrastructureEvent.source == "redis")
        .order_by(InfrastructureEvent.created_at.desc())
        .limit(10)
    )
    events = events_res.scalars().all()
    recent_events = [{
        "time": e.created_at.isoformat(),
        "instance": e.title.split(" ")[0] if " " in e.title else "System",
        "event": e.message
    } for e in events]

    return {
        "summary": {
            "instances": total,
            "servers": len(set(i["server_id"] for i in all_instances)),
            "healthy": healthy_count,
            "memory_used": _format_memory(total_memory),
            "keys": total_keys,
            "clients": total_clients,
            "ops_sec": round(total_ops, 1)
        },
        "instances": paginated,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 0
        },
        "top_memory": top_memory_list[:5],
        "events": recent_events,
        "sampled_at": datetime.now(timezone.utc).isoformat()
    }
