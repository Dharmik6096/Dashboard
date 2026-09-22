from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import asyncio
import structlog
import uuid

from app.database import get_db
from app.models.server import Server
from app.models.container import Container
from app.models.audit import CredentialVault
from app.services.credential_vault import decrypt_credential
from app.services.ssh_client import SSHClient

router = APIRouter(prefix="/processes", tags=["processes"])
log = structlog.get_logger()

# Max seconds to wait for SSH process fetch per server
_SSH_PROCESS_TIMEOUT = 12


async def _fetch_server_processes(server, db: AsyncSession, scope: str, container_id: Optional[str]) -> List[Dict[str, Any]]:
    """Fetch processes for a single server with timeout protection."""
    results = []

    target_container = None
    if scope == "container":
        if container_id:
            try:
                c_res = await db.execute(select(Container).where(
                    Container.id == uuid.UUID(container_id),
                    Container.server_id == server.id
                ))
                target_container = c_res.scalars().first()
                if not target_container:
                    return results
            except ValueError:
                return results

    if scope == "container" and container_id and not target_container:
        return results

    password = None
    private_key = None
    cred_res = await db.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))
    cred = cred_res.scalars().first()
    if cred:
        decrypted = decrypt_credential(cred.encrypted_value)
        if cred.auth_type == "password":
            password = decrypted
        else:
            private_key = decrypted

    ssh = SSHClient(
        host=server.ip_address,
        port=server.ssh_port,
        username=server.ssh_username or "root",
        password=password,
        private_key=private_key
    )

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        if scope == "server":
            res = await asyncio.wait_for(ssh.server_processes(), timeout=_SSH_PROCESS_TIMEOUT)
            for p in res.get("processes", []):
                p["server_id"] = str(server.id)
                p["server_name"] = server.name
                p["container_id"] = p.get("container_id", None)
                p["container_name"] = p.get("container_name", None)
                p["sampled_at"] = now_iso
                results.append(p)
        elif scope == "container":
            if target_container:
                res = await asyncio.wait_for(
                    ssh.container_top(target_container.container_id),
                    timeout=_SSH_PROCESS_TIMEOUT
                )
                for p in res.get("processes", []):
                    p["server_id"] = str(server.id)
                    p["server_name"] = server.name
                    p["container_id"] = str(target_container.id)
                    p["container_name"] = target_container.name
                    p["sampled_at"] = now_iso
                    results.append(p)
            else:
                c_all_res = await db.execute(select(Container).where(
                    Container.server_id == server.id,
                    Container.status == "running"
                ))
                running_containers = c_all_res.scalars().all()
                # Limit to top 5 containers to avoid N sequential SSH connections
                top_containers = sorted(
                    running_containers,
                    key=lambda c: c.last_cpu_percent or 0,
                    reverse=True
                )[:5]

                async def _fetch_one_container(c):
                    try:
                        res = await asyncio.wait_for(
                            ssh.container_top(c.container_id),
                            timeout=_SSH_PROCESS_TIMEOUT
                        )
                        procs = []
                        for p in res.get("processes", []):
                            p["server_id"] = str(server.id)
                            p["server_name"] = server.name
                            p["container_id"] = str(c.id)
                            p["container_name"] = c.name
                            p["sampled_at"] = now_iso
                            procs.append(p)
                        return procs
                    except (asyncio.TimeoutError, Exception) as e:
                        log.warning("container_top_error", server=server.name, container=c.name, error=str(e))
                        return []

                container_results = await asyncio.gather(*[_fetch_one_container(c) for c in top_containers])
                for procs in container_results:
                    results.extend(procs)
    except asyncio.TimeoutError:
        log.warning("process_fetch_timeout", server=server.name, scope=scope)
    except Exception as e:
        log.error("process_fetch_error", server=server.name, error=str(e))

    return results


def _parse_state(state: str | None) -> str:
    """Return canonical first-char state letter. Handles None and multi-char states."""
    if not state:
        return ""
    return str(state)[0].upper()


@router.get("")
async def get_processes(
    environment: Optional[str] = None,
    server_id: Optional[str] = None,
    scope: str = Query("server", description="server or container"),
    container_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Rows per page (max 100)"),
    sort: str = Query("cpu_percent", description="Sort column"),
    order: str = Query("desc", description="asc or desc"),
    db: AsyncSession = Depends(get_db)
):
    """
    Return paginated process list with full summary across all matched processes.
    Summary counts ALL matched processes; table returns only the requested page.
    Environment filter is case-insensitive.
    """
    # ── Server scope ────────────────────────────────────────────────────────
    query = select(Server).where(Server.is_active == True)

    # Case-insensitive environment filter — normalise both sides to lower
    if environment and environment.lower() not in ("", "all environments", "all"):
        query = query.where(func.lower(Server.environment) == environment.lower())

    if server_id:
        try:
            query = query.where(Server.id == uuid.UUID(server_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid server_id")

    servers_result = await db.execute(query)
    servers = servers_result.scalars().all()
    selected_servers_count = len(servers)

    # Only fetch from online servers
    online_servers = [s for s in servers if s.status == "online"]

    server_states = []

    if not online_servers:
        return {
            "scope": {
                "environment": environment or "all",
                "server_id": server_id,
                "mode": scope,
                "container_id": container_id
            },
            "summary": {
                "total_processes": 0,
                "high_cpu": 0,
                "high_memory": 0,
                "running": 0,
                "sleeping": 0,
                "selected_servers": selected_servers_count,
                "reporting_servers": 0
            },
            "processes": [],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": 0,
                "total_pages": 0,
                "has_next": False,
                "has_previous": False
            },
            "total_matching": 0,
            "returned_rows": 0,
            "sampled_at": datetime.now(timezone.utc).isoformat(),
            "server_states": [{
                "server_id": str(s.id),
                "server_name": s.name,
                "status": s.status
            } for s in servers]
        }

    # ── Fetch all servers concurrently ─────────────────────────────────────
    tasks = [
        _fetch_server_processes(server, db, scope, container_id)
        for server in online_servers
    ]
    results_per_server = await asyncio.gather(*tasks, return_exceptions=True)

    all_processes = []
    reporting_servers_count = 0
    for server, result in zip(online_servers, results_per_server):
        if isinstance(result, Exception):
            log.error("process_gather_error", error=str(result), server=server.name)
            server_states.append({"server_id": str(server.id), "server_name": server.name, "status": "ERROR"})
        elif isinstance(result, list):
            if len(result) > 0:
                reporting_servers_count += 1
            all_processes.extend(result)
            server_states.append({"server_id": str(server.id), "server_name": server.name, "status": "OK"})

    # ── Search filter ───────────────────────────────────────────────────────
    if search:
        s = search.lower()
        filtered = []
        for p in all_processes:
            if (s in str(p.get("pid", "")).lower() or
                s in str(p.get("user", "")).lower() or
                s in str(p.get("name", "")).lower() or
                s in str(p.get("command", "")).lower() or
                s in str(p.get("server_name", "")).lower() or
                s in str(p.get("container_name", "")).lower()):
                filtered.append(p)
        all_processes = filtered

    # ── Summary — computed across ALL matched processes ─────────────────────
    total_matching = len(all_processes)
    high_cpu = 0
    high_memory = 0
    running = 0
    sleeping = 0

    for p in all_processes:
        if (p.get("cpu_percent") or 0) > 10:
            high_cpu += 1
        if (p.get("memory_percent") or 0) > 5:
            high_memory += 1
        s_first = _parse_state(p.get("state"))
        if s_first == "R":
            running += 1
        elif s_first == "S":
            sleeping += 1

    # ── Sort ────────────────────────────────────────────────────────────────
    _SORT_MAP = {
        "cpu": "cpu_percent",
        "cpu_percent": "cpu_percent",
        "mem": "memory_percent",
        "memory_percent": "memory_percent",
        "pid": "pid",
        "rss": "rss_bytes",
        "rss_bytes": "rss_bytes",
        "name": "name",
        "user": "user",
        "state": "state",
        "uptime": "elapsed_seconds",
        "elapsed_seconds": "elapsed_seconds",
        "server": "server_name",
        "server_name": "server_name",
    }
    sort_key = _SORT_MAP.get(sort, "cpu_percent")
    reverse = order.lower() != "asc"

    try:
        all_processes.sort(
            key=lambda p: (p.get(sort_key) is None, p.get(sort_key) or 0 if isinstance(p.get(sort_key), (int, float)) else str(p.get(sort_key) or "")),
            reverse=reverse
        )
    except Exception:
        pass  # If sort fails, keep original order

    # ── Paginate ────────────────────────────────────────────────────────────
    total_pages = max(1, (total_matching + page_size - 1) // page_size)
    # Clamp page to valid range
    page = min(page, total_pages)
    offset = (page - 1) * page_size
    page_processes = all_processes[offset: offset + page_size]

    sampled_at = (
        page_processes[0]["sampled_at"]
        if page_processes
        else (all_processes[0]["sampled_at"] if all_processes else datetime.now(timezone.utc).isoformat())
    )

    return {
        "scope": {
            "environment": environment or "all",
            "server_id": server_id,
            "mode": scope,
            "container_id": container_id
        },
        "summary": {
            "total_processes": total_matching,
            "high_cpu": high_cpu,
            "high_memory": high_memory,
            "running": running,
            "sleeping": sleeping,
            "selected_servers": selected_servers_count,
            "reporting_servers": reporting_servers_count
        },
        "processes": page_processes,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_matching,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        },
        "total_matching": total_matching,
        "returned_rows": len(page_processes),
        "sampled_at": sampled_at,
        "server_states": server_states
    }
