import json
import logging
import asyncio
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.server import Server
from app.models.container import Container
from app.models.nginx import NginxConfig, NginxServerBlock, NginxLocation, NginxUpstream, NginxUpstreamTarget
from app.models.infrastructure_event import InfrastructureEvent
from app.redis_client import cache_get, cache_set
from app.services.metrics_ingester import _classify_bind_scope, _SENSITIVE_PATTERNS, _parse_ss_output, _service_name

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ports", tags=["ports"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load_all_port_snapshots(
    db: AsyncSession,
    environment: Optional[str] = None,
    server_id: Optional[str] = None,
) -> tuple[list[dict], list[dict]]:
    q = select(Server).where(Server.is_active == True)
    # Case-insensitive environment filter
    if environment and environment.lower() not in ("all", "all environments", ""):
        q = q.where(func.lower(Server.environment) == environment.lower())
    # Proper UUID conversion for server_id
    if server_id and server_id not in ("all", ""):
        try:
            q = q.where(Server.id == _uuid.UUID(server_id))
        except ValueError:
            pass  # Invalid UUID — ignore filter

    result = await db.execute(q)
    servers = result.scalars().all()

    live_ports: list[dict] = []
    stale_ports: list[dict] = []

    for srv in servers:
        key = f"server:{srv.id}:ports"
        raw = await cache_get(key)
        is_live = srv.status in ("online", "warning", "critical")

        if raw:
            try:
                port_map: dict = json.loads(raw)
                for p in port_map.values():
                    p["server_status"] = srv.status
                    p["environment"] = srv.environment
                    if is_live:
                        live_ports.append(p)
                    else:
                        p["freshness"] = "stale"
                        stale_ports.append(p)
            except Exception:
                pass
        elif is_live:
            # Cache miss for an online server — attempt live SSH fallback (read-only)
            try:
                ssh_ports = await _collect_ports_via_ssh(srv, db)
                if ssh_ports:
                    # Cache the result so the next call is instant
                    await cache_set(key, json.dumps(ssh_ports), ttl=120)
                    for p in ssh_ports.values():
                        p["server_status"] = srv.status
                        p["environment"] = srv.environment
                        live_ports.append(p)
            except Exception as _e:
                log.warning("ports_ssh_fallback_failed", server=srv.name, error=str(_e))

    return live_ports, stale_ports


async def _collect_ports_via_ssh(srv: Server, db: AsyncSession) -> dict:
    """
    Read-only SSH fallback: run 'ss -H -lntup', parse, return port map dict.
    Only called when Redis cache is empty for an online server.
    No writes to remote server. No sudo unless already allowed.
    """
    from app.models.audit import CredentialVault
    from app.services.credential_vault import decrypt_credential
    from app.services.ssh_client import SSHClient

    cred_res = await db.execute(select(CredentialVault).where(CredentialVault.server_id == srv.id))
    cred = cred_res.scalar_one_or_none()
    if not cred or not srv.ssh_username:
        return {}

    decrypted = decrypt_credential(cred.encrypted_value)
    ssh = SSHClient(
        host=srv.ip_address,
        port=srv.ssh_port,
        username=srv.ssh_username,
        password=decrypted if cred.auth_type == "password" else None,
        private_key=decrypted if cred.auth_type == "ssh_key" else None,
    )

    try:
        raw_out, _, _ = await asyncio.wait_for(
            ssh._run_command_full("ss -H -lntup", timeout=10),
            timeout=15
        )
    except Exception:
        # Fallback: try without process info (no permission needed for socket list)
        try:
            raw_out, _, _ = await asyncio.wait_for(
                ssh._run_command_full("ss -H -lntu", timeout=10),
                timeout=15
            )
        except Exception:
            return {}

    if not raw_out:
        return {}

    raw_ports = _parse_ss_output(raw_out)

    # Docker port correlation from DB containers
    containers_res = await db.execute(
        select(Container).where(Container.server_id == srv.id, Container.status == "running")
    )
    containers = containers_res.scalars().all()
    host_port_to_container: dict[str, dict] = {}
    for c in containers:
        c_ports = c.ports or {}
        for container_port_proto, host_bindings in c_ports.items():
            if not host_bindings:
                continue
            cp_parts = container_port_proto.split("/")
            container_port = int(cp_parts[0]) if cp_parts[0].isdigit() else None
            if container_port is None:
                continue
            for binding in (host_bindings if isinstance(host_bindings, list) else []):
                try:
                    hp = int(binding.get("HostPort", "0"))
                    if hp > 0:
                        host_port_to_container[str(hp)] = {
                            "container_id": c.container_id,
                            "container_name": c.name,
                            "container_port": container_port,
                            "image": c.image,
                            "network_mode": c.network_mode,
                        }
                except Exception:
                    pass

    now_iso = datetime.now(timezone.utc).isoformat()
    server_id_str = str(srv.id)
    new_ports: dict[str, dict] = {}

    for p in raw_ports:
        port_key = f"{p['protocol']}:{p['bind_address']}:{p['port']}"
        container_info = host_port_to_container.get(str(p["port"]))
        source = "docker" if container_info else "host"
        service = _service_name(p.get("process_name"), p["port"])

        new_ports[port_key] = {
            "server_id": server_id_str,
            "server_name": srv.name,
            "ip_address": srv.ip_address,
            "protocol": p["protocol"],
            "state": p["state"],
            "port": p["port"],
            "bind_address": p["bind_address"],
            "bind_scope": p["bind_scope"],
            "service": service,
            "process_name": p.get("process_name"),
            "pid": p.get("pid"),
            "container_id": container_info["container_id"] if container_info else None,
            "container_name": container_info["container_name"] if container_info else None,
            "container_port": container_info["container_port"] if container_info else None,
            "image": container_info["image"] if container_info else None,
            "network_mode": container_info["network_mode"] if container_info else None,
            "source": source,
            "first_seen": now_iso,
            "last_seen": now_iso,
            "freshness": "live",
        }

    log.info("ports_ssh_fallback_ok", server=srv.name, count=len(new_ports))
    return new_ports




def _apply_filters(
    ports: list[dict],
    protocol: Optional[str] = None,
    bind_scope: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    result = ports
    if protocol and protocol.lower() not in ("all", "all protocols", ""):
        result = [p for p in result if p.get("protocol", "").lower() == protocol.lower()]
    if bind_scope and bind_scope.lower() not in ("all", "all bind scopes", "all ports", ""):
        result = [p for p in result if p.get("bind_scope", "").upper() == bind_scope.upper()]
    if search:
        s = search.lower()
        filtered = []
        for p in result:
            haystack = " ".join([
                str(p.get("server_name", "")),
                str(p.get("ip_address", "")),
                str(p.get("port", "")),
                str(p.get("service", "")),
                str(p.get("process_name", "")),
                str(p.get("pid", "")),
                str(p.get("container_name", "")),
                str(p.get("bind_address", "")),
            ]).lower()
            if s in haystack:
                filtered.append(p)
        result = filtered
    return result


def _sort_ports(ports: list[dict], sort: str) -> list[dict]:
    if sort == "port_asc":
        return sorted(ports, key=lambda p: p.get("port", 0))
    if sort == "port_desc":
        return sorted(ports, key=lambda p: p.get("port", 0), reverse=True)
    if sort == "server":
        return sorted(ports, key=lambda p: p.get("server_name", ""))
    if sort == "last_seen":
        return sorted(ports, key=lambda p: p.get("last_seen", ""), reverse=True)
    if sort == "attention":
        return sorted(ports, key=lambda p: _attention_score(p), reverse=True)
    return sorted(ports, key=lambda p: p.get("port", 0))


def _attention_score(port: dict) -> int:
    score = 0
    service = (port.get("service") or "").lower()
    process = (port.get("process_name") or "").lower()
    scope = port.get("bind_scope", "")
    port_num = port.get("port", 0)

    if scope == "WIDE":
        for pat in _SENSITIVE_PATTERNS:
            if pat in service or pat in process:
                score += 10
                break
        if service == "ssh" or process == "sshd" or port_num == 22:
            score += 5

    if not port.get("process_name") and not port.get("container_name"):
        score += 3

    return score


def _build_attention_items(ports: list[dict]) -> list[dict]:
    items = []
    for p in ports:
        service = (p.get("service") or "").lower()
        process = (p.get("process_name") or "").lower()
        scope = p.get("bind_scope", "")
        port_num = p.get("port", 0)

        # Rule A: Wide-bind sensitive service
        if scope == "WIDE":
            for pat in _SENSITIVE_PATTERNS:
                if pat in service or pat in process:
                    items.append({
                        "server": p.get("server_name"),
                        "port": port_num,
                        "service": p.get("service"),
                        "issue": f"{p.get('service') or process} (port {port_num}) uses wide bind (0.0.0.0)",
                        "severity": "warning",
                        "rule": "wide_bind_sensitive",
                    })
                    break
            if (service == "ssh" or process == "sshd" or port_num == 22) and not any(
                i["port"] == port_num and i["server"] == p.get("server_name") for i in items
            ):
                items.append({
                    "server": p.get("server_name"),
                    "port": port_num,
                    "service": p.get("service"),
                    "issue": f"SSH (port {port_num}) uses wide bind",
                    "severity": "info",
                    "rule": "ssh_wide_bind",
                })

        # Rule C: Unknown ownership
        if not p.get("process_name") and not p.get("container_name"):
            items.append({
                "server": p.get("server_name"),
                "port": port_num,
                "service": p.get("service"),
                "issue": f"Port {port_num} has no identified owning process",
                "severity": "info",
                "rule": "unknown_ownership",
            })

    # Deduplicate
    seen = set()
    unique = []
    for item in items:
        k = f"{item['server']}:{item['port']}:{item['rule']}"
        if k not in seen:
            seen.add(k)
            unique.append(item)

    return unique[:50]


# ---------------------------------------------------------------------------
# Nginx Correlation
# ---------------------------------------------------------------------------

async def _load_nginx_correlation(db: AsyncSession, server_ids: list) -> dict:
    if not server_ids:
        return {}

    result = await db.execute(
        select(NginxConfig).where(NginxConfig.server_id.in_(server_ids))
    )
    configs = result.scalars().all()
    if not configs:
        return {}

    config_ids = [c.id for c in configs]
    config_server_map = {c.id: c.server_id for c in configs}

    sb_result = await db.execute(
        select(NginxServerBlock).where(NginxServerBlock.config_id.in_(config_ids))
    )
    server_blocks = sb_result.scalars().all()

    sb_ids = [sb.id for sb in server_blocks]
    loc_result = await db.execute(
        select(NginxLocation).where(NginxLocation.server_block_id.in_(sb_ids))
    )
    locations = loc_result.scalars().all()
    loc_map: dict[int, list] = {}
    for loc in locations:
        loc_map.setdefault(loc.server_block_id, []).append(loc)

    upstream_result = await db.execute(
        select(NginxUpstream).where(NginxUpstream.config_id.in_(config_ids))
    )
    upstreams = upstream_result.scalars().all()
    upstream_ids = [u.id for u in upstreams]
    upstream_name_map = {u.id: u.name for u in upstreams}

    target_result = await db.execute(
        select(NginxUpstreamTarget).where(NginxUpstreamTarget.upstream_id.in_(upstream_ids))
    )
    targets = target_result.scalars().all()
    upstream_targets: dict[str, list] = {}
    for t in targets:
        uname = upstream_name_map.get(t.upstream_id, "")
        upstream_targets.setdefault(uname, []).append({"host": t.host, "port": t.port})

    correlation: dict[str, dict] = {}
    nginx_route_count = 0

    for sb in server_blocks:
        listen_str = sb.listen or ""
        listen_port = None
        for part in listen_str.split():
            port_part = part.split(":")[-1]
            if port_part.isdigit():
                listen_port = int(port_part)
                break

        if listen_port is None:
            continue

        server_id = str(config_server_map.get(sb.config_id, ""))
        map_key = f"{server_id}:{listen_port}"

        locs_for_sb = loc_map.get(sb.id, [])
        proxy_passes = [loc.proxy_pass for loc in locs_for_sb if loc.proxy_pass]

        resolved_upstreams = []
        for pp in proxy_passes:
            pp_clean = pp.strip().rstrip("/")
            for uname, utargets in upstream_targets.items():
                if uname in pp_clean:
                    resolved_upstreams.extend(utargets)

        correlation[map_key] = {
            "server_name_nginx": sb.server_name,
            "listen_port": listen_port,
            "ssl": sb.ssl,
            "proxy_passes": proxy_passes,
            "resolved_upstreams": resolved_upstreams,
            "source": "nginx",
        }
        nginx_route_count += 1

    correlation["__count__"] = nginx_route_count  # type: ignore
    return correlation


# ---------------------------------------------------------------------------
# Dashboard Endpoint
# ---------------------------------------------------------------------------

@router.get("/dashboard")
async def get_ports_dashboard(
    environment: Optional[str] = Query(None),
    server_id: Optional[str] = Query(None),
    protocol: Optional[str] = Query(None),
    bind_scope: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("port_asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=10, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only ports dashboard endpoint.
    Returns summary + filtered port inventory + aggregated data in one payload.
    """
    live_ports, stale_ports = await _load_all_port_snapshots(db, environment, server_id)
    all_ports = live_ports + stale_ports

    server_ids = list({p.get("server_id") for p in all_ports if p.get("server_id")})
    nginx_correlation = await _load_nginx_correlation(db, server_ids)
    nginx_route_count = nginx_correlation.pop("__count__", 0)

    for p in all_ports:
        nk = f"{p.get('server_id')}:{p.get('port')}"
        if nk in nginx_correlation:
            ninfo = nginx_correlation[nk]
            p["nginx_server_name"] = ninfo.get("server_name_nginx")
            p["nginx_proxy_passes"] = ninfo.get("proxy_passes", [])
            p["nginx_resolved_upstreams"] = ninfo.get("resolved_upstreams", [])
            p["nginx_ssl"] = ninfo.get("ssl", False)
            if p.get("source") != "docker":
                p["source"] = "nginx"

    filtered_all = _apply_filters(all_ports, protocol, bind_scope, search)
    filtered_live = [p for p in filtered_all if p.get("freshness") == "live"]

    wide_ports = [p for p in filtered_live if p.get("bind_scope") == "WIDE"]
    docker_ports = [p for p in filtered_live if p.get("container_name")]

    unique_services = set()
    for p in filtered_live:
        svc = (p.get("service") or "").lower()
        if svc and svc != "unknown":
            unique_services.add(svc)

    attention_items = _build_attention_items(filtered_live)
    reporting_servers = len({p.get("server_id") for p in filtered_live})

    summary = {
        "open_ports": len(filtered_live),
        "wide_bind_ports": len(wide_ports),
        "listening_services": len(unique_services),
        "attention_needed": len(attention_items),
        "docker_published_ports": len(docker_ports),
        "nginx_routes": nginx_route_count,
        "reporting_servers": reporting_servers,
        "sampled_at": datetime.now(timezone.utc).isoformat(),
    }

    sorted_ports = _sort_ports(filtered_all, sort)
    total = len(sorted_ports)
    offset = (page - 1) * page_size
    page_ports = sorted_ports[offset: offset + page_size]

    wide_port_counts: dict[int, int] = {}
    for p in filtered_live:
        if p.get("bind_scope") == "WIDE":
            pn = p.get("port", 0)
            wide_port_counts[pn] = wide_port_counts.get(pn, 0) + 1

    top_wide_ports = sorted(wide_port_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    total_wide = len(wide_ports)
    top_wide = [
        {
            "port": port,
            "count": count,
            "pct": round(count / total_wide * 100) if total_wide > 0 else 0,
        }
        for port, count in top_wide_ports
    ]

    service_counts: dict[str, int] = {}
    for p in filtered_live:
        svc = (p.get("service") or "unknown").lower()
        service_counts[svc] = service_counts.get(svc, 0) + 1

    top_services_sorted = sorted(service_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    total_live = len(filtered_live)
    ports_by_service = [
        {
            "service": svc,
            "count": count,
            "pct": round(count / total_live * 100) if total_live > 0 else 0,
        }
        for svc, count in top_services_sorted
    ]

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    events_q = (
        select(InfrastructureEvent, Server.name.label("server_name"))
        .join(Server, InfrastructureEvent.server_id == Server.id)
        .where(
            InfrastructureEvent.source == "port",
            InfrastructureEvent.created_at >= since,
        )
        .order_by(desc(InfrastructureEvent.created_at))
        .limit(20)
    )
    events_res = await db.execute(events_q)
    rows = events_res.all()

    recent_changes = []
    for ev, srv_name in rows:
        recent_changes.append({
            "time": ev.created_at.isoformat() if ev.created_at else None,
            "server": srv_name,
            "event_type": ev.event_type,
            "title": ev.title,
            "details": ev.details or {},
        })

    return {
        "summary": summary,
        "ports": page_ports,
        "total_ports": total,
        "page": page,
        "page_size": page_size,
        "top_wide_bind_ports": top_wide,
        "ports_by_service": ports_by_service,
        "recent_changes": recent_changes,
        "attention": attention_items,
        "sampled_at": datetime.now(timezone.utc).isoformat(),
    }
