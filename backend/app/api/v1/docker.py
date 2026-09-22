from datetime import datetime, timezone, timedelta
import asyncio
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_, and_
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.container import Container, ContainerEvent
from app.models.metric import ContainerMetric
from app.models.server import Server
from app.services.ssh_client import SSHClient
from app.models.audit import CredentialVault
from app.services.credential_vault import decrypt_credential

router = APIRouter(prefix="/docker", tags=["docker"])

async def _get_ssh_client(server: Server, db: AsyncSession) -> Optional[SSHClient]:
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

@router.get("/dashboard")
async def get_docker_dashboard(
    environment: Optional[str] = Query(None, description="Environment ID or Name"),
    server_id: Optional[str] = Query(None, description="Server ID"),
    state: Optional[str] = Query(None, description="Container state (Running, Exited, etc)"),
    search: Optional[str] = Query(None, description="Search term for name/image/id"),
    period: str = Query("1h", description="Time period for resource trends"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    # 1. Base Query for Containers
    query = select(Container).options(joinedload(Container.server))
    
    # Apply Environment Filter
    if environment and environment != "All Environments" and environment != "all":
        query = query.join(Server, Container.server_id == Server.id)
        query = query.where(func.lower(Server.environment) == environment.lower())
    elif server_id or search:
        query = query.outerjoin(Server, Container.server_id == Server.id)

    # Apply Server Filter
    if server_id and server_id != "All Servers" and server_id != "all":
        query = query.where(Container.server_id == server_id)

    # Apply State Filter
    if state and state != "All States" and state != "all":
        query = query.where(func.lower(Container.status) == state.lower())

    # Apply Search
    if search:
        search_term = f"%{search}%"
        query = query.where(or_(
            Container.name.ilike(search_term),
            Container.container_id.ilike(search_term),
            Container.image.ilike(search_term),
            Server.name.ilike(search_term)
        ))

    # 2. Aggregates
    total_query = select(func.count(Container.id)).select_from(query.subquery())
    total_containers = (await db.execute(total_query)).scalar() or 0
    
    running_query = select(func.count(Container.id)).select_from(query.where(func.lower(Container.status) == 'running').subquery())
    running_count = (await db.execute(running_query)).scalar() or 0
    
    restarting_query = select(func.count(Container.id)).select_from(query.where(func.lower(Container.status) == 'restarting').subquery())
    restarting_count = (await db.execute(restarting_query)).scalar() or 0

    unhealthy_query = select(func.count(Container.id)).select_from(query.where(func.lower(Container.health_status) == 'unhealthy').subquery())
    unhealthy_count = (await db.execute(unhealthy_query)).scalar() or 0

    avg_cpu_query = select(func.avg(Container.last_cpu_percent)).select_from(query.where(func.lower(Container.status) == 'running').subquery())
    avg_cpu = (await db.execute(avg_cpu_query)).scalar() or 0.0

    avg_mem_query = select(func.avg(Container.last_mem_usage)).select_from(query.where(func.lower(Container.status) == 'running').subquery())
    avg_mem = (await db.execute(avg_mem_query)).scalar() or 0.0

    # 3. Pagination & Container List
    sort_query = query.order_by(desc(Container.last_cpu_percent))
    
    paginated_query = sort_query.offset((page - 1) * page_size).limit(page_size)
    containers_result = await db.execute(paginated_query)
    containers = containers_result.scalars().all()

    container_list = []
    for c in containers:
        container_list.append({
            "id": str(c.id),
            "server_id": str(c.server_id),
            "server_name": getattr(c.server, "name", "Unknown Server") if getattr(c, "server", None) else "Unknown Server",
            "container_id": c.container_id,
            "name": c.name,
            "image": c.image,
            "status": c.status, 
            "health_status": c.health_status or "N/A",
            "restart_count": c.restart_count,
            "ports": c.ports,
            "last_cpu_percent": c.last_cpu_percent,
            "last_mem_usage": c.last_mem_usage,
            "last_mem_limit": c.last_mem_limit,
            "last_seen": c.last_seen.isoformat() if c.last_seen else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    # 4. Top CPU & Memory (Global across the filtered scope)
    top_cpu_query = query.where(func.lower(Container.status) == 'running').order_by(desc(Container.last_cpu_percent)).limit(8)
    top_cpu_result = await db.execute(top_cpu_query)
    top_cpu = [{"name": c.name, "value": c.last_cpu_percent} for c in top_cpu_result.scalars().all()]

    top_mem_query = query.where(func.lower(Container.status) == 'running').order_by(desc(Container.last_mem_usage)).limit(8)
    top_mem_result = await db.execute(top_mem_query)
    top_mem = [{"name": c.name, "value": c.last_mem_usage} for c in top_mem_result.scalars().all()]

    # 5. Recent Events
    events_query_fixed = select(ContainerEvent).options(joinedload(ContainerEvent.container)).join(Container, ContainerEvent.container_db_id == Container.id)
    if server_id and server_id != "All Servers" and server_id != "all":
        events_query_fixed = events_query_fixed.where(Container.server_id == server_id)
    events_query_fixed = events_query_fixed.order_by(desc(ContainerEvent.occurred_at)).limit(10)
    events_result_fixed = await db.execute(events_query_fixed)
    
    recent_events = []
    for e in events_result_fixed.scalars().all():
        recent_events.append({
            "id": str(e.id),
            "container_name": getattr(e.container, "name", "Unknown"),
            "server_name": getattr(getattr(e.container, "server", None), "name", "Unknown"),
            "event_type": e.event_type,
            "reason": e.reason,
            "occurred_at": e.occurred_at.isoformat()
        })

    # 6. Resource Trends
    resource_history = []

    # 7. Images & Volumes 
    images = []
    volumes = []
    
    if server_id and server_id != "All Servers" and server_id != "all":
        server_res = await db.execute(select(Server).where(Server.id == server_id))
        target_server = server_res.scalar_one_or_none()
        if target_server:
            ssh_client = await _get_ssh_client(target_server, db)
            if ssh_client:
                images_task = ssh_client.docker_images()
                volumes_task = ssh_client.docker_volumes()
                res = await asyncio.gather(images_task, volumes_task, return_exceptions=True)
                if not isinstance(res[0], Exception): images = res[0]
                if not isinstance(res[1], Exception): volumes = res[1]

    return {
        "summary": {
            "total_containers": total_containers,
            "running": running_count,
            "unhealthy": unhealthy_count,
            "restarting": restarting_count,
            "avg_cpu_usage": round(avg_cpu, 2),
            "avg_ram_usage": avg_mem,
        },
        "containers": container_list,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_containers,
            "total_pages": (total_containers + page_size - 1) // page_size if page_size else 0
        },
        "top_cpu": top_cpu,
        "top_memory": top_mem,
        "recent_events": recent_events,
        "resource_history": resource_history,
        "images": images,
        "volumes": volumes,
        "sampled_at": datetime.now(timezone.utc).isoformat()
    }
