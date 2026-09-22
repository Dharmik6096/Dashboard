from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.infrastructure_event import InfrastructureEvent
from app.models.container import ContainerEvent
from app.models.audit import AuditLog

router = APIRouter(prefix="/events", tags=["events"])

@router.get("")
async def get_all_events(
    env: str = Query(None),
    server_id: str = None, 
    source_type: str = None,
    severity: str = None,
    limit: int = Query(100, le=500), 
    db: AsyncSession = Depends(get_db)
):
    from app.models.server import Server
    from sqlalchemy import func
    
    # Fetch Infrastructure Events
    infra_query = select(InfrastructureEvent).order_by(InfrastructureEvent.detected_at.desc())
    
    if env and env.lower() not in ("all", "all environments", ""):
        infra_query = infra_query.join(Server, InfrastructureEvent.server_id == Server.id).where(func.lower(Server.environment) == env.lower())
        
    if server_id and server_id.lower() not in ("all", "all servers", ""): 
        infra_query = infra_query.where(InfrastructureEvent.server_id == server_id)
        
    if severity: 
        infra_query = infra_query.where(InfrastructureEvent.severity == severity)
    
    # We must filter by source if provided, but source_type maps to source in infra
    if source_type:
        infra_query = infra_query.where(InfrastructureEvent.source == source_type)

    infra_res = await db.execute(infra_query.limit(limit))
    infra_events = infra_res.scalars().all()

    # Fetch Container Events
    container_query = select(ContainerEvent).order_by(ContainerEvent.created_at.desc())
    
    if env and env.lower() not in ("all", "all environments", ""):
        container_query = container_query.join(Server, ContainerEvent.server_id == Server.id).where(func.lower(Server.environment) == env.lower())
        
    if server_id and server_id.lower() not in ("all", "all servers", ""): 
        container_query = container_query.where(ContainerEvent.server_id == server_id)
        
    # Container events are implicitly source_type="container"
    
    container_events = []
    if not source_type or source_type == "container":
        # we don't have severity on container events natively yet, assume info or map it
        # Actually let's fetch them if severity isn't filtering strictly
        cont_res = await db.execute(container_query.limit(limit))
        container_events = cont_res.scalars().all()

    normalized = []
    for e in infra_events:
        normalized.append({
            "id": f"infra-{e.id}",
            "timestamp": e.detected_at.isoformat(),
            "server_id": str(e.server_id),
            "source": e.source,
            "source_type": e.source,
            "event_type": e.event_type,
            "severity": e.severity,
            "title": e.title,
            "details": e.details
        })

    for e in container_events:
        # For ContainerEvent, we map severity based on event_type
        sev = "info"
        if e.event_type in ["die", "oom", "kill"]: sev = "critical"
        elif e.event_type in ["restart"]: sev = "warning"
        
        if severity and sev != severity:
            continue
            
        normalized.append({
            "id": f"cont-{e.id}",
            "timestamp": e.created_at.isoformat(),
            "server_id": str(e.server_id),
            "source": e.container_id[:12] if e.container_id else "docker",
            "source_type": "container",
            "event_type": e.event_type,
            "severity": sev,
            "title": f"Container {e.event_type}",
            "details": e.message
        })

    # Sort combined
    normalized.sort(key=lambda x: x["timestamp"], reverse=True)
    return normalized[:limit]
