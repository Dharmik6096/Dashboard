from datetime import datetime, timezone
import asyncio
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.server import Server
from app.models.audit import CredentialVault
from app.services.credential_vault import decrypt_credential
from app.services.ssh_client import SSHClient

router = APIRouter(prefix="/cron", tags=["cron"])

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

@router.get("")
async def get_all_cron_jobs(
    server_id: Optional[str] = Query(None, description="Filter by specific server ID"),
    search: Optional[str] = Query(None, description="Search term for command/user/schedule"),
    status: Optional[str] = Query("all", description="all, active, disabled"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Server).where(Server.is_active == True)
    if server_id and server_id.lower() != "all":
        query = query.where(Server.id == server_id)
        
    result = await db.execute(query)
    servers = result.scalars().all()
    
    all_cron_jobs = []
    servers_fetched = 0
    total_disabled = 0
    
    # Process sequentially or in batches if needed, doing sequentially for simplicity and safety for now
    for server in servers:
        if server.status == "offline":
            continue
            
        client = await _get_ssh_client(server, db)
        if not client:
            continue
            
        try:
            res = await client.get_cron_jobs()
            jobs = res.get("cron_jobs", [])
            servers_fetched += 1
            
            for job in jobs:
                job["server_id"] = str(server.id)
                job["server_name"] = server.name
                all_cron_jobs.append(job)
        except Exception:
            pass
            
    # Apply filters
    filtered_jobs = []
    search_lower = search.lower() if search else None
    
    for job in all_cron_jobs:
        if status == "disabled" and not job["is_disabled"]:
            continue
        if status == "active" and job["is_disabled"]:
            continue
            
        if search_lower:
            match = False
            for field in ["command", "user", "schedule", "comment", "server_name"]:
                val = job.get(field)
                if val and search_lower in str(val).lower():
                    match = True
                    break
            if not match:
                continue
                
        if job["is_disabled"]:
            total_disabled += 1
            
        filtered_jobs.append(job)
        
    return {
        "summary": {
            "total_jobs": len(filtered_jobs),
            "disabled": total_disabled,
            "servers_fetched": servers_fetched
        },
        "cron_jobs": filtered_jobs,
        "sampled_at": datetime.now(timezone.utc).isoformat()
    }
