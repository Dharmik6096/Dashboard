from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import asyncio
import uuid
import structlog

from app.database import get_db
from app.models.server import Server
from app.services.rabbitmq_service import RabbitmqService
from app.models.infrastructure_event import InfrastructureEvent

router = APIRouter(prefix="/rabbitmq", tags=["rabbitmq"])
log = structlog.get_logger()

@router.get("/brokers")
async def get_rabbitmq_brokers(
    environment: str = Query("all", description="Environment filter"),
    server_id: str = Query("all", description="Server filter"),
    vhost: str = Query("all", description="VHost filter"),
    search: str = Query("", description="Search term"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = Query("status_asc", description="Sort order"),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch Servers matching filters
    server_query = select(Server).where(Server.is_active == True)
    if environment != "all":
        server_query = server_query.where(func.lower(Server.environment) == environment.lower())
    if server_id != "all":
        server_query = server_query.where(Server.id == server_id)
        
    servers_res = await db.execute(server_query)
    servers = servers_res.scalars().all()
    
    online_servers = [s for s in servers if s.status == "online"]
    
    # 2. Fetch brokers concurrently
    tasks = [
        RabbitmqService._fetch_server_rabbitmq(server, db)
        for server in online_servers
    ]
    results_per_server = await asyncio.gather(*tasks, return_exceptions=True)
    
    all_brokers = []
    for server, result in zip(online_servers, results_per_server):
        if isinstance(result, Exception):
            log.error("rabbitmq_gather_error", error=str(result), server=server.name)
        elif isinstance(result, list):
            all_brokers.extend(result)
            
    # Extract ALL available options BEFORE filtering
    unique_servers = []
    seen_servers = set()
    for b in all_brokers:
        if b["server_id"] not in seen_servers:
            seen_servers.add(b["server_id"])
            unique_servers.append({"id": b["server_id"], "name": b["server_name"]})
            
    unique_vhosts = list(set(b.get("vhost", "/") for b in all_brokers))

    # Apply VHost & Search filters
    filtered = []
    for b in all_brokers:
        b["vhost"] = b.get("vhost", "/") # Default to /
        
        if vhost != "all" and b["vhost"] != vhost:
            continue
            
        if search:
            search_lower = search.lower()
            if not (search_lower in b["server_name"].lower() or 
                    search_lower in b["container_name"].lower() or 
                    search_lower in b["broker_name"].lower()):
                continue
                
        filtered.append(b)
        
    all_brokers = filtered

    # Compute Summary
    total_brokers = len(all_brokers)
    healthy_brokers = sum(1 for b in all_brokers if b["status"] == "Healthy")
    total_queues = sum(b.get("queues", 0) for b in all_brokers)
    total_consumers = sum(b.get("consumers", 0) for b in all_brokers)
    total_messages_ready = sum(b.get("messages_ready", 0) for b in all_brokers)
    total_publish_rate = sum(b.get("publish_rate", 0) for b in all_brokers)

    # Sort
    if sort == "status_asc":
        # Unhealthy first
        status_rank = {"Critical": 0, "Warning": 1, "Unknown": 2, "Unavailable": 3, "Healthy": 4}
        all_brokers.sort(key=lambda x: (status_rank.get(x["status"], 5), x["server_name"]))
    elif sort == "ready_desc":
        all_brokers.sort(key=lambda x: x.get("messages_ready", 0), reverse=True)
    elif sort == "publish_desc":
        all_brokers.sort(key=lambda x: x.get("publish_rate", 0), reverse=True)
        
    # Paginate
    total_pages = max(1, (total_brokers + page_size - 1) // page_size)
    page = min(page, total_pages)
    start = (page - 1) * page_size
    paginated_brokers = all_brokers[start:start + page_size]
    
    # Collect Events
    events_res = await db.execute(
        select(InfrastructureEvent)
        .where(InfrastructureEvent.source == "rabbitmq")
        .order_by(InfrastructureEvent.created_at.desc())
        .limit(10)
    )
    events = events_res.scalars().all()
    recent_events = [{
        "time": e.created_at.isoformat(),
        "server": str(e.server_id),
        "event": e.title
    } for e in events]
    
    # Aggregate Queues for top queues panel
    all_queues = []
    for b in all_brokers:
        for q in b.get("queue_list", []):
            all_queues.append(q)
            
    top_ready_queues = sorted(all_queues, key=lambda x: x.get("messages_ready", 0), reverse=True)[:5]
    top_consumer_queues = sorted(all_queues, key=lambda x: x.get("consumers", 0), reverse=True)[:5]
    
    return {
        "summary": {
            "total_brokers": total_brokers,
            "healthy_brokers": healthy_brokers,
            "servers_count": len(set(b["server_id"] for b in all_brokers)),
            "queues": total_queues,
            "consumers": total_consumers,
            "messages_ready": total_messages_ready,
            "publish_rate": total_publish_rate
        },
        "filters": {
            "servers": unique_servers,
            "vhosts": unique_vhosts
        },
        "brokers": paginated_brokers,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_brokers,
            "total_pages": total_pages
        },
        "top_busy_queues": top_ready_queues,
        "top_consumer_queues": top_consumer_queues,
        "recent_events": recent_events,
        "sampled_at": datetime.now(timezone.utc).isoformat()
    }
