from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.infrastructure_event import InfrastructureEvent
from app.models.container import ContainerEvent

router = APIRouter(prefix="/events", tags=["events"])


def _infrastructure_event_dict(event, server_name: str | None) -> dict:
    return {"id": f"infra-{event.id}", "timestamp": event.detected_at.isoformat(), "server_id": str(event.server_id), "server_name": server_name, "source": event.source, "source_type": event.source, "event_type": event.event_type, "severity": event.severity, "title": event.title, "details": event.details}


def _container_event_dict(event, server_name: str | None) -> dict:
    severity = "info"
    if event.event_type in {"die", "oom", "oom_killed", "kill"} or event.oom_killed:
        severity = "critical"
    elif event.event_type == "restart":
        severity = "warning"
    return {"id": f"cont-{event.id}", "timestamp": event.occurred_at.isoformat(), "server_id": str(event.server_id), "server_name": server_name, "source": event.container_name or "docker", "source_type": "container", "event_type": event.event_type, "severity": severity, "title": f"Container {event.event_type.replace('_', ' ')}", "details": event.reason}

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
    container_query = select(ContainerEvent).order_by(ContainerEvent.occurred_at.desc())
    
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

    server_ids = {event.server_id for event in infra_events}
    server_ids.update(event.server_id for event in container_events)
    server_names = {}
    if server_ids:
        server_rows = await db.execute(select(Server.id, Server.name).where(Server.id.in_(server_ids)))
        server_names = {server_id: name for server_id, name in server_rows.all()}

    normalized = [_infrastructure_event_dict(event, server_names.get(event.server_id)) for event in infra_events]

    for e in container_events:
        item = _container_event_dict(e, server_names.get(e.server_id))
        if severity and item["severity"] != severity:
            continue
        normalized.append(item)

    # Sort combined
    normalized.sort(key=lambda x: x["timestamp"], reverse=True)
    return normalized[:limit]
