"""Server management and live metrics routes."""
import uuid
from typing import Optional
from datetime import datetime, timezone, timedelta
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, delete, func
import pydantic
from pydantic import BaseModel
import asyncssh
import structlog

from app.database import get_db, AsyncSessionLocal
from app.models.server import Server
from app.models.metric import ServerMetric, DiskMetric
from app.models.audit import CredentialVault
from app.services.credential_vault import encrypt_credential, decrypt_credential
from app.services.agent_client import AgentClient
from app.redis_client import cache_get

router = APIRouter(prefix="/servers", tags=["servers"])


class ServerCreate(BaseModel):
    name: str
    environment: str
    ip_address: str
    ssh_port: int = 22
    ssh_username: Optional[str] = None
    auth_type: Optional[str] = None
    ssh_credential: Optional[str] = None  # key or password (encrypted in vault)
    tags: Optional[list[str]] = None
    description: Optional[str] = None
    agent_url: Optional[str] = None
    agent_token: Optional[str] = None  # stored hashed
    monitoring_mode: str = "auto"

class TestConnectionRequest(BaseModel):
    ip_address: str
    ssh_port: int = 22
    ssh_username: Optional[str] = None
    auth_type: Optional[str] = None
    ssh_credential: Optional[str] = None
    agent_url: Optional[str] = None
    agent_token: Optional[str] = None
    monitoring_mode: str = "auto"


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    environment: Optional[str] = None
    tags: Optional[list[str]] = None
    description: Optional[str] = None
    agent_url: Optional[str] = None
    agent_token: Optional[str] = None
    is_active: Optional[bool] = None


def _server_to_dict(server: Server) -> dict:
    return {
        "id": str(server.id),
        "name": server.name,
        "environment": server.environment,
        "ip_address": server.ip_address,
        "hostname": server.hostname,
        "ssh_port": server.ssh_port,
        "ssh_username": server.ssh_username,
        "auth_type": server.auth_type,
        "agent_url": server.agent_url,
        "monitoring_mode": server.monitoring_mode,
        "tags": server.tags or [],
        "description": server.description,
        "status": server.status,
        "last_seen": server.last_seen.isoformat() if server.last_seen else None,
        "last_check_at": server.last_check_at.isoformat() if server.last_check_at else None,
        "last_success_at": server.last_success_at.isoformat() if server.last_success_at else None,
        "monitoring_source": server.monitoring_source,
        "last_cpu_percent": server.last_cpu_percent,
        "last_ram_percent": server.last_ram_percent,
        "last_disk_percent": server.last_disk_percent,
        "load_avg": getattr(server, "last_load_1", None),
        "uptime_seconds": getattr(server, "last_uptime_seconds", None),
        "os": getattr(server, "os", None),
        "architecture": getattr(server, "architecture", None),
        "cpu_cores": getattr(server, "cpu_cores", None),
        "ram_total": getattr(server, "ram_total", None),
        "created_at": server.created_at.isoformat(),
        "is_active": getattr(server, "is_active", True)
    }


@router.get("")
async def list_servers(env: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    from app.models.container import Container
    from app.models.alert import Alert
    
    query = select(Server).where(Server.is_active == True)
    if env and env.lower() != "all":
        query = query.where(func.lower(Server.environment) == env.lower())
    
    result = await db.execute(query.order_by(Server.name))
    servers = result.scalars().all()
    server_ids = [s.id for s in servers]
    
    cont_counts = {}
    alert_counts = {}
    
    if server_ids:
        c_res = await db.execute(select(Container.server_id, func.count(Container.id)).where(Container.server_id.in_(server_ids)).group_by(Container.server_id))
        cont_counts = {row[0]: row[1] for row in c_res.all()}
        
        a_res = await db.execute(select(Alert.server_id, func.count(Alert.id)).where(Alert.server_id.in_(server_ids), Alert.status == 'active').group_by(Alert.server_id))
        alert_counts = {row[0]: row[1] for row in a_res.all()}
        
    out = []
    for s in servers:
        d = _server_to_dict(s)
        d["container_count"] = cont_counts.get(s.id, 0) if s.status != "offline" else None
        d["alert_count"] = alert_counts.get(s.id, 0)
        out.append(d)
        
    return out


async def test_ssh_connection_task(server_id: uuid.UUID, host: str, port: int, username: str, password: str):
    try:
        async with asyncssh.connect(host, port=port, username=username, password=password, known_hosts=None) as conn:
            async with AsyncSessionLocal() as db:
                await db.execute(update(Server).where(Server.id == server_id).values(
                    status="online", last_seen=datetime.now(timezone.utc)
                ))
                await db.commit()
    except Exception as e:
        log = structlog.get_logger()
        log.error("ssh_test_failed", server_id=str(server_id), error=str(e))

@router.post("/test-connection")
async def test_server_connection(body: TestConnectionRequest):
    result = {
        "ssh": {"status": "skipped"}
    }
    
    # Phase 1: Only SSH testing
    if body.ip_address and body.ssh_credential:
        from app.services.ssh_client import SSHClient
        client = SSHClient(
            host=body.ip_address,
            port=body.ssh_port,
            username=body.ssh_username,
            password=body.ssh_credential if body.auth_type == "password" else None,
            private_key=body.ssh_credential if body.auth_type == "ssh_key" else None
        )
        ssh_res = await client.test_connection()
        if ssh_res["success"]:
            result["ssh"] = {
                "status": "success",
                "os": ssh_res.get("os"),
                "hostname": ssh_res.get("hostname"),
                "docker_available": ssh_res.get("docker_available"),
                "cpu_cores": ssh_res.get("cpu_cores"),
                "ram_total": ssh_res.get("ram_total")
            }
        else:
            result["ssh"] = {
                "status": "error",
                "reason": ssh_res.get("reason", "Unknown error"),
                "step": ssh_res.get("failed_step", "Connection")
            }
            
    return result

@router.post("/{server_id}/test")
async def test_existing_server_connection(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    client = await _get_ssh_client(server, db)
    if not client:
        return {"ssh": {"status": "error", "reason": "No SSH credentials configured", "step": "Authentication"}}
    ssh_res = await client.test_connection()
    result = {"ssh": {}}
    if ssh_res["success"]:
        result["ssh"] = {
            "status": "success",
            "os": ssh_res.get("os"),
            "hostname": ssh_res.get("hostname"),
            "docker_available": ssh_res.get("docker_available"),
            "cpu_cores": ssh_res.get("cpu_cores"),
            "ram_total": ssh_res.get("ram_total")
        }
    else:
        result["ssh"] = {
            "status": "error",
            "reason": ssh_res.get("reason", "Unknown error"),
            "step": ssh_res.get("failed_step", "Connection")
        }
    return result

@router.post("", status_code=201)
async def add_server(body: ServerCreate, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # Check duplicate name
    existing_name = await db.execute(select(Server).where(Server.name == body.name))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Server name already exists")

    # Check duplicate IP + Port
    existing_ip_query = await db.execute(
        select(Server).where(
            Server.ip_address == body.ip_address,
            Server.ssh_port == body.ssh_port
        )
    )
    existing_server = existing_ip_query.scalar_one_or_none()

    if existing_server:
        if existing_server.is_active:
            raise HTTPException(status_code=409, detail=f"Server with IP {body.ip_address}:{body.ssh_port} already exists")
        else:
            # Restore inactive server
            server = existing_server
            server.is_active = True
            server.name = body.name
            server.environment = body.environment
            server.ssh_username = body.ssh_username
            server.auth_type = body.auth_type
            server.tags = body.tags
            server.description = body.description
            server.agent_url = body.agent_url
            server.agent_token_hash = body.agent_token
            server.monitoring_mode = body.monitoring_mode
            # Clear old vault credential later
    else:
        server = Server(
            name=body.name,
            environment=body.environment,
            ip_address=body.ip_address,
            ssh_port=body.ssh_port,
            ssh_username=body.ssh_username,
            auth_type=body.auth_type,
            tags=body.tags,
            description=body.description,
            agent_url=body.agent_url,
            agent_token_hash=body.agent_token,
            monitoring_mode=body.monitoring_mode,
        )
        db.add(server)

    await db.flush()

    # Store credential in vault if provided
    if body.ssh_credential and body.auth_type:
        # If restoring, delete old credential first
        if existing_server:
            await db.execute(delete(CredentialVault).where(CredentialVault.server_id == server.id))
            
        vault = CredentialVault(
            server_id=server.id,
            auth_type=body.auth_type,
            encrypted_value=encrypt_credential(body.ssh_credential),
        )
        db.add(vault)
        if body.auth_type == "password" and body.ssh_username:
            background_tasks.add_task(
                test_ssh_connection_task, server.id, body.ip_address, body.ssh_port, body.ssh_username, body.ssh_credential
            )

    await db.commit()
    return _server_to_dict(server)


@router.get("/{server_id}")
async def get_server(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    return _server_to_dict(server)


@router.put("/{server_id}")
async def update_server(server_id: str, body: ServerUpdate, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(server, field, value)
    await db.commit()
    return _server_to_dict(server)


@router.delete("/{server_id}", status_code=204)
async def remove_server(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    server.is_active = False
    await db.commit()


@router.get("/{server_id}/processes")
async def get_server_processes(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    if server.monitoring_mode in ["auto", "ssh"]:
        ssh_client = await _get_ssh_client(server, db)
        if ssh_client:
            return await ssh_client.server_processes()
    return {"processes": []}



@router.get("/{server_id}/metrics/live")
async def get_live_metrics(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    cached = await cache_get(f"server:{server.id}:live")
    if cached:
        import json
        return json.loads(cached)
    # Fallback: fetch directly from agent
    if server.agent_url and server.agent_token_hash:
        client = AgentClient(server.agent_url, server.agent_token_hash, server.name)
        return await client.host_metrics() or {}
    return {}


@router.get("/{server_id}/metrics/history")
async def get_metric_history(
    server_id: str,
    period: str = Query("1h", description="1h|6h|24h|7d|30d"),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server_or_404(server_id, db)
    since = _period_to_datetime(period)
    result = await db.execute(
        select(ServerMetric)
        .where(ServerMetric.server_id == server.id, ServerMetric.time >= since)
        .order_by(ServerMetric.time)
    )
    metrics = result.scalars().all()
    return [
        {
            "time": m.time.isoformat(),
            "cpu_percent": m.cpu_percent,
            "load_1": m.load_1,
            "load_5": m.load_5,
            "load_15": m.load_15,
            "ram_used": m.ram_used,
            "ram_total": m.ram_total,
            "net_rx_rate": m.net_rx_rate,
            "net_tx_rate": m.net_tx_rate,
        }
        for m in metrics
    ]


@router.get("/{server_id}/processes")
async def get_processes(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    if server.agent_url:
        client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
        return await client.processes() or {}
    
    ssh_client = await _get_ssh_client(server, db)
    if ssh_client:
        return await ssh_client.get_processes()
    return {}


@router.get("/{server_id}/disk")
async def get_disk(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    
    cached = await cache_get(f"server:{server.id}:disk")
    if cached:
        import json
        return json.loads(cached)
        
    if server.agent_url:
        client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
        return await client.disk_metrics() or {}
        
    ssh_client = await _get_ssh_client(server, db)
    if ssh_client:
        return await ssh_client.disk_metrics() or {}
    return {}


@router.get("/{server_id}/network")
async def get_network(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    
    cached = await cache_get(f"server:{server.id}:network")
    if cached:
        import json
        return json.loads(cached)
        
    if server.agent_url:
        client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
        return await client.network_metrics() or {}
        
    ssh_client = await _get_ssh_client(server, db)
    if ssh_client:
        return await ssh_client.network_metrics() or {}
    return {}




async def _get_server_or_404(server_id: str, db: AsyncSession) -> Server:
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


def _period_to_datetime(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    mapping = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}
    hours = mapping.get(period, 1)
    return now - timedelta(hours=hours)
from app.models.nginx import NginxConfig, NginxServerBlock, NginxLocation, NginxUpstream, NginxUpstreamTarget
from app.services.nginx_parser import parse_nginx_config, extract_server_blocks, extract_upstreams
import hashlib

@router.get("/{server_id}/nginx")
async def get_server_nginx(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    client = await _get_ssh_client(server, db)
    if not client:
        return {"status": "error", "error": "No SSH credentials configured"}
    nginx_data = await client.get_nginx_config()
    
    if nginx_data.get("error"):
        return {"status": "error", "error": nginx_data["error"]}
        
    config_text = nginx_data.get("config", "")
    config_hash = hashlib.sha256(config_text.encode()).hexdigest()
    
    # Store or update in database
    result = await db.execute(select(NginxConfig).where(NginxConfig.server_id == server_id))
    existing_config = result.scalars().first()
    
    if not existing_config or existing_config.config_hash != config_hash:
        from app.models.infrastructure_event import InfrastructureEvent
        
        if existing_config:
            # Log the change
            event = InfrastructureEvent(
                server_id=server.id,
                event_type="nginx_config_changed",
                source="nginx",
                severity="info",
                title="Nginx Configuration Changed",
                details={"old_hash": existing_config.config_hash, "new_hash": config_hash}
            )
            db.add(event)
            await db.delete(existing_config)
            
        parsed = parse_nginx_config(config_text)
        servers = extract_server_blocks(parsed)
        upstreams = extract_upstreams(parsed)
        
        new_config = NginxConfig(
            server_id=server_id,
            enabled_path="/etc/nginx/nginx.conf" if nginx_data.get("source") == "files" else "nginx -T",
            source_path="nginx -T",
            config_hash=config_hash
        )
        db.add(new_config)
        await db.flush()
        
        for srv in servers:
            directives = {s["directive"]: s["args"] for s in srv if "directive" in s}
            block = NginxServerBlock(
                config_id=new_config.id,
                server_name=" ".join(directives.get("server_name", [])),
                listen=" ".join(directives.get("listen", [])),
                ssl="ssl" in directives.get("listen", [])
            )
            db.add(block)
            await db.flush()
            
            for loc in [s for s in srv if s.get("directive") == "location"]:
                loc_dirs = {d["directive"]: d["args"] for d in loc.get("block", [])}
                db.add(NginxLocation(
                    server_block_id=block.id,
                    path=loc["args"][0] if loc["args"] else "/",
                    proxy_pass=" ".join(loc_dirs.get("proxy_pass", []))
                ))
                
        for up in upstreams:
            upstream_obj = NginxUpstream(config_id=new_config.id, name=up["name"])
            db.add(upstream_obj)
            await db.flush()
            
            for t in [s for s in up["block"] if s.get("directive") == "server"]:
                args = t["args"]
                if not args: continue
                
                host = args[0]
                port = None
                
                # Handle IPv6 like [::1]:8080
                if host.startswith("[") and "]:" in host:
                    parts = host.split("]:")
                    host = parts[0] + "]"
                    if parts[1].isdigit():
                        port = int(parts[1])
                # Handle IPv4 and hostnames with port
                elif ":" in host and not host.startswith("unix:"):
                    parts = host.split(":")
                    if parts[-1].isdigit():
                        port = int(parts[-1])
                        host = ":".join(parts[:-1])
                        
                def get_int_arg(prefix):
                    for a in args:
                        if a.startswith(prefix):
                            val = a.split("=")[1]
                            return int(val) if val.isdigit() else None
                    return None
                    
                def get_str_arg(prefix):
                    for a in args:
                        if a.startswith(prefix):
                            return a.split("=")[1]
                    return None
                        
                target = NginxUpstreamTarget(
                    upstream_id=upstream_obj.id,
                    host=host,
                    port=port,
                    weight=get_int_arg("weight="),
                    max_fails=get_int_arg("max_fails="),
                    fail_timeout=get_str_arg("fail_timeout="),
                    backup="backup" in args,
                    down="down" in args
                )
                db.add(target)
                
        await db.commit()
    
    # Reload and return
    result = await db.execute(select(NginxConfig).where(NginxConfig.server_id == server_id))
    conf = result.scalars().first()
    if not conf:
        return {"status": "empty"}
        
    # Lazy load relations manually or just return what we have (for simplicity, we return the parsed raw data in API if we want)
    # Return basic info to frontend
    # Since SQLAlchemy async lazy loading is complex, we just fetch it
    res_blocks = await db.execute(select(NginxServerBlock).where(NginxServerBlock.config_id == conf.id))
    blocks = res_blocks.scalars().all()
    
    out_blocks = []
    for b in blocks:
        res_locs = await db.execute(select(NginxLocation).where(NginxLocation.server_block_id == b.id))
        locs = res_locs.scalars().all()
        out_blocks.append({
            "server_name": b.server_name,
            "listen": b.listen,
            "ssl": b.ssl,
            "locations": [{"path": l.path, "proxy_pass": l.proxy_pass} for l in locs]
        })
        
    res_ups = await db.execute(select(NginxUpstream).where(NginxUpstream.config_id == conf.id))
    ups = res_ups.scalars().all()
    
    out_ups = []
    for u in ups:
        res_targs = await db.execute(select(NginxUpstreamTarget).where(NginxUpstreamTarget.upstream_id == u.id))
        targs = res_targs.scalars().all()
        out_ups.append({
            "name": u.name,
            "targets": [{"host": t.host, "port": t.port, "weight": t.weight, "backup": t.backup, "down": t.down} for t in targs]
        })
        
    return {
        "status": "success",
        "hash": conf.config_hash,
        "collected_at": conf.collected_at.isoformat(),
        "server_blocks": out_blocks,
        "upstreams": out_ups
    }

async def _get_server_or_404(server_id: str, db: AsyncSession) -> Server:
    server = await db.get(Server, server_id)
    if not server or not getattr(server, "is_active", True):
        raise HTTPException(status_code=404, detail="Server not found")
    return server

async def _get_ssh_client(server: Server, db: AsyncSession) -> "SSHClient | None":
    from app.models.audit import CredentialVault
    from app.services.ssh_client import SSHClient
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

@router.get("/{server_id}/cron")
async def get_server_cron(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await _get_server_or_404(server_id, db)
    client = await _get_ssh_client(server, db)
    return await client.get_cron_jobs() if client else {}

@router.get("/{server_id}/ports")
async def get_server_ports(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    client = await _get_ssh_client(server, db)
    if not client:
        return {"listening": []}
    return await client.get_listening_ports()

@router.get("/{server_id}/services")
async def get_server_services(server_id: str, db: AsyncSession = Depends(get_db)):
    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    client = await _get_ssh_client(server, db)
    if not client: return {"services": []}
    return await client.get_services(["nginx", "docker", "cron", "sshd"])

@router.get("/{server_id}/logs")
async def get_server_logs(
    server_id: str,
    source: str = Query(..., description="nginx, syslog, cron"),
    lines: int = 200,
    db: AsyncSession = Depends(get_db)
):
    server = await db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    ssh = await _get_ssh_client(server, db)
    if not ssh: return {"logs": []}
    try:
        await ssh.connect()
        
        target_file = ""
        if source == "nginx":
            target_file = "/var/log/nginx/access.log"
        elif source == "nginx_error":
            target_file = "/var/log/nginx/error.log"
        elif source == "syslog":
            target_file = "/var/log/syslog"
        elif source == "auth":
            target_file = "/var/log/auth.log"
        else:
            raise HTTPException(400, "Unknown source")
            
        cmd = f"tail -n {lines} {target_file}"
        out, err, code = await ssh._run_with_sudo_fallback(cmd, "Server Logs")
        output = out if code == 0 else (err or out)
        import re
        output = re.sub(r"\[sudo\] password for [^:]+:\s*", "", output)
        
        parsed = []
        for line in output.splitlines():
            if not line.strip(): continue
            parsed.append({
                "timestamp": "", 
                "level": "info",
                "message": line.strip(),
                "raw": line.strip()
            })
            
        return {"logs": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Log fetch failed: {str(e)}")
    finally:
        await ssh.disconnect()
