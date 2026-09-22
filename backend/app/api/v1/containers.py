"""Container routes — list, detail, metrics, processes, logs, inspect, restart history."""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.container import Container, ContainerEvent
from app.models.metric import ContainerMetric
from app.models.server import Server
from app.services.agent_client import AgentClient
from app.services.ssh_client import SSHClient
from app.models.audit import CredentialVault
from app.services.credential_vault import decrypt_credential
from app.redis_client import cache_get

router = APIRouter(prefix="/containers", tags=["containers"])


def _container_to_dict(c: Container) -> dict:
    return {
        "id": str(c.id),
        "server_id": str(c.server_id),
        "server_name": getattr(c.server, "name", "Unknown Server") if getattr(c, "server", None) else "Unknown Server",
        "container_id": c.container_id,
        "name": c.name,
        "image": c.image,
        "status": c.status,
        "restart_count": c.restart_count,
        "exit_code": c.exit_code,
        "oom_killed": c.oom_killed,
        "health_status": c.health_status,
        "network_mode": c.network_mode,
        "ports": c.ports,
        "volumes": c.volumes,
        "labels": c.labels,
        "env_vars": c.env_vars_masked,  # Already masked
        "last_cpu_percent": c.last_cpu_percent,
        "last_mem_usage": c.last_mem_usage,
        "last_mem_limit": c.last_mem_limit,
        "last_seen": c.last_seen.isoformat() if c.last_seen else None,
        "created_at": c.created_at.isoformat(),
    }


@router.get("")
async def list_all_containers(
    env: str | None = Query(None),
    server_id: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    query = select(Container).options(joinedload(Container.server))
    
    if env and env.lower() not in ("all", "all environments", ""):
        query = query.join(Container.server).where(func.lower(Server.environment) == env.lower())
    elif server_id:
        # Note: if server_id is provided, it usually implies the environment, but if we want strictly server_id filtering we keep it.
        # However, to match processes.py behavior, we join if env is there. 
        # Actually, query.join(Container.server) is needed for Server.environment
        pass

    if server_id and server_id.lower() not in ("all", "all servers", ""):
        query = query.where(Container.server_id == server_id)
        
    if status and status.lower() not in ("all", ""):
        query = query.where(Container.status == status)
        
    query = query.order_by(desc(Container.last_cpu_percent))
    result = await db.execute(query)
    return [_container_to_dict(c) for c in result.scalars().all()]


@router.get("/{container_id}")
async def get_container(container_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_container_or_404(container_id, db)
    return _container_to_dict(c)


@router.get("/{container_id}/metrics/live")
async def get_container_live_metrics(container_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_container_or_404(container_id, db)
    # The cache key includes the full ID now, but we don't have it directly in this function without a DB query.
    # Luckily c.container_full_id exists if it's stored.
    cached = await cache_get(f"container:{c.server_id}:{c.container_full_id}:live")
    if cached:
        import json
        return json.loads(cached)
    return {}


@router.get("/{container_id}/metrics/history")
async def get_container_metric_history(
    container_id: str,
    period: str = Query("1h"),
    db: AsyncSession = Depends(get_db),
):
    c = await _get_container_or_404(container_id, db)
    since = _period_since(period)
    result = await db.execute(
        select(ContainerMetric)
        .where(ContainerMetric.container_db_id == c.id, ContainerMetric.time >= since)
        .order_by(ContainerMetric.time)
    )
    return [
        {
            "time": m.time.isoformat(),
            "cpu_percent": m.cpu_percent,
            "cpu_normalized": m.cpu_normalized,
            "mem_usage": m.mem_usage,
            "mem_limit": m.mem_limit,
            "mem_percent": m.mem_percent,
            "net_rx_rate": m.net_rx_rate,
            "net_tx_rate": m.net_tx_rate,
            "block_read_rate": m.block_read_rate,
            "block_write_rate": m.block_write_rate,
            "pids": m.pids,
        }
        for m in result.scalars().all()
    ]


@router.get("/{container_id}/processes")
async def get_container_processes(container_id: str, db: AsyncSession = Depends(get_db)):
    """Processes inside container via host /proc — works even without ps inside container."""
    c, server = await _get_container_and_server(container_id, db)
    mode = getattr(server, "monitoring_mode", "auto")
    
    if mode in ["auto", "agent"] and server.agent_url:
        client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
        return await client.container_top(c.container_id) or {}
        
    if mode in ["auto", "ssh"]:
        ssh_client = await _get_ssh_client(server, db)
        if ssh_client:
            return await ssh_client.container_top(c.container_full_id or c.container_id)
    return {}


@router.get("/{container_id}/logs")
async def get_container_logs(
    container_id: str,
    tail: int = Query(100),
    since: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    c, server = await _get_container_and_server(container_id, db)
    mode = getattr(server, "monitoring_mode", "auto")
    
    if mode in ["auto", "agent"] and server.agent_url:
        client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
        return await client.container_logs(c.container_id, tail=tail, since=since) or {}
        
    if mode in ["auto", "ssh"]:
        ssh_client = await _get_ssh_client(server, db)
        if ssh_client:
            return await ssh_client.container_logs(c.container_full_id or c.container_id, tail=tail, since=since)
    return {}


@router.get("/{container_id}/inspect")
async def get_container_inspect(container_id: str, db: AsyncSession = Depends(get_db)):
    """Full docker inspect data — env vars masked."""
    c, server = await _get_container_and_server(container_id, db)
    mode = getattr(server, "monitoring_mode", "auto")
    data = {}
    
    if mode in ["auto", "agent"] and server.agent_url:
        client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
        data = await client.container_inspect(c.container_id) or {}
    elif mode in ["auto", "ssh"]:
        ssh_client = await _get_ssh_client(server, db)
        if ssh_client:
            data = await ssh_client.container_inspect(c.container_full_id or c.container_id) or {}
            
    # Mask env vars in raw inspect data
    from app.services.secret_masker import mask_env_vars
    if data and "env" in data:
        data["env"] = mask_env_vars(data["env"])
    return data


@router.get("/{container_id}/restart-history")
async def get_restart_history(container_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_container_or_404(container_id, db)
    result = await db.execute(
        select(ContainerEvent)
        .where(ContainerEvent.container_db_id == c.id)
        .order_by(desc(ContainerEvent.occurred_at))
        .limit(100)
    )
    events = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "exit_code": e.exit_code,
            "oom_killed": e.oom_killed,
            "restart_count": e.restart_count,
            "reason": e.reason,
            "occurred_at": e.occurred_at.isoformat(),
        }
        for e in events
    ]


async def _get_container_or_404(container_id: str, db: AsyncSession) -> Container:
    result = await db.execute(select(Container).options(joinedload(Container.server)).where(Container.id == container_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Container not found")
    return c


async def _get_ssh_client(server: Server, db: AsyncSession) -> SSHClient | None:
    v_res = await db.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))
    vault = v_res.scalar_one_or_none()
    if vault and server.ssh_username:
        return SSHClient(
            host=server.ip_address,
            port=server.ssh_port,
            username=server.ssh_username,
            password=decrypt_credential(vault.encrypted_value) if vault.auth_type == "password" else None,
            private_key=decrypt_credential(vault.encrypted_value) if vault.auth_type == "ssh_key" else None
        )
    return None


async def _get_container_and_server(container_id: str, db: AsyncSession) -> tuple[Container, Server]:
    c = await _get_container_or_404(container_id, db)
    result = await db.execute(select(Server).where(Server.id == c.server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return c, server


def _period_since(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    hours = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}.get(period, 1)
    return now - timedelta(hours=hours)
