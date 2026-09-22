"""Search API — global search across servers, containers, IPs, ports."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.server import Server
from app.models.container import Container

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def global_search(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    q_lower = f"%{q.lower()}%"
    results = []

    # Search servers
    server_result = await db.execute(
        select(Server).where(
            or_(
                Server.name.ilike(q_lower),
                Server.ip_address.ilike(q_lower),
                Server.hostname.ilike(q_lower),
                Server.description.ilike(q_lower),
            )
        ).limit(20)
    )
    for s in server_result.scalars().all():
        results.append({
            "type": "server",
            "id": str(s.id),
            "name": s.name,
            "subtitle": s.ip_address,
            "status": s.status,
            "environment": s.environment,
            "url": f"/servers/{s.id}",
        })

    # Search containers
    container_result = await db.execute(
        select(Container).where(
            or_(
                Container.name.ilike(q_lower),
                Container.image.ilike(q_lower),
                Container.container_id.ilike(q_lower),
            )
        ).limit(30)
    )
    for c in container_result.scalars().all():
        results.append({
            "type": "container",
            "id": str(c.id),
            "name": c.name,
            "subtitle": c.image,
            "status": c.status,
            "server_id": str(c.server_id),
            "cpu_percent": c.last_cpu_percent,
            "mem_usage": c.last_mem_usage,
            "url": f"/containers/{c.id}",
        })

    # Search Nginx Server Blocks
    from app.models.nginx import NginxServerBlock, NginxConfig
    nginx_blocks = await db.execute(
        select(NginxServerBlock, NginxConfig).join(NginxConfig).where(
            NginxServerBlock.server_name.ilike(q_lower)
        ).limit(20)
    )
    for block, conf in nginx_blocks.all():
        results.append({
            "type": "domain",
            "id": str(block.id),
            "name": block.server_name,
            "subtitle": f"Listen: {block.listen}",
            "status": "online",
            "server_id": str(conf.server_id),
            "url": f"/servers/{conf.server_id}",
        })
        
    # Search Nginx Upstreams
    from app.models.nginx import NginxUpstream, NginxUpstreamTarget
    nginx_upstreams = await db.execute(
        select(NginxUpstream, NginxConfig).join(NginxConfig).where(
            NginxUpstream.name.ilike(q_lower)
        ).limit(20)
    )
    for up, conf in nginx_upstreams.all():
        results.append({
            "type": "nginx_upstream",
            "id": str(up.id),
            "name": up.name,
            "subtitle": "Nginx Upstream Target",
            "status": "online",
            "server_id": str(conf.server_id),
            "url": f"/servers/{conf.server_id}",
        })

    # Search Ports / Upstream Targets
    if q.isdigit():
        q_port = int(q)
        upstream_targets = await db.execute(
            select(NginxUpstreamTarget, NginxUpstream, NginxConfig)
            .join(NginxUpstream)
            .join(NginxConfig)
            .where(NginxUpstreamTarget.port == q_port)
            .limit(20)
        )
        for targ, up, conf in upstream_targets.all():
            results.append({
                "type": "port",
                "id": str(targ.id),
                "name": str(targ.port),
                "subtitle": f"Target in Upstream: {up.name}",
                "status": "online",
                "server_id": str(conf.server_id),
                "url": f"/servers/{conf.server_id}",
            })

    return {"query": q, "count": len(results), "results": results}
