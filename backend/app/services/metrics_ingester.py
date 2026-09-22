"""
Metrics Ingester — polls agent snapshots, stores to DB, publishes to Redis pub/sub.
Runs on a schedule via APScheduler. Does NOT use SSH.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Any
import re

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import AsyncSessionLocal
from app.redis_client import publish_metric, cache_set, cache_get
from app.services.agent_client import AgentClient
from app.services.secret_masker import mask_env_vars
from app.models.server import Server
from app.models.audit import CredentialVault
from app.services.credential_vault import decrypt_credential
from app.services.ssh_client import SSHClient
from app.models.container import Container, ContainerEvent
from app.models.metric import ServerMetric, ContainerMetric, DiskMetric

log = structlog.get_logger()

# Track previous network/disk stats for rate calculation
_prev_net: dict[str, dict] = {}
_prev_container_net: dict[str, dict] = {}
_prev_container_blk: dict[str, dict] = {}


def _parse_bytes(s: str) -> int:
    s = s.strip().upper()
    if s.endswith("B"):
        s = s[:-1]
    multiplier = 1
    if s.endswith("KI"): multiplier = 1024
    elif s.endswith("K"): multiplier = 1000
    elif s.endswith("MI"): multiplier = 1024**2
    elif s.endswith("M"): multiplier = 1000**2
    elif s.endswith("GI"): multiplier = 1024**3
    elif s.endswith("G"): multiplier = 1000**3
    elif s.endswith("TI"): multiplier = 1024**4
    elif s.endswith("T"): multiplier = 1000**4
    
    m = re.match(r'^[\d\.]+', s)
    if m:
        try:
            return int(float(m.group(0)) * multiplier)
        except:
            return 0
    return 0

def _parse_disk_bytes(val: Any) -> int | None:
    if val is None: return None
    if isinstance(val, (int, float)): return int(val)
    return _parse_bytes(str(val))


def _parse_io(io_str: str) -> tuple[int, int]:
    parts = io_str.split(" / ")
    if len(parts) == 2:
        return _parse_bytes(parts[0]), _parse_bytes(parts[1])
    return 0, 0


async def ingest_server(server: Server) -> bool:
    """Poll one server, store metrics, publish to Redis. Returns True if online."""
    snapshot = None
    used_source = None
    mode = getattr(server, "monitoring_mode", "auto")
    
    # Try Agent if allowed
    if mode in ["auto", "agent"] and server.agent_url:
        client = AgentClient(
            base_url=server.agent_url,
            token=server.agent_token_hash or "",
            server_name=server.name,
        )
        snapshot = await client.snapshot()
        if snapshot:
            used_source = "agent"
        
    # Fallback to SSH if Agent failed or SSH is preferred
    if snapshot is None and mode in ["auto", "ssh"]:
        async with AsyncSessionLocal() as db:
            v_res = await db.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))
            vault = v_res.scalar_one_or_none()
        
        if vault and server.ssh_username:
            try:
                ssh_client = SSHClient(
                    host=server.ip_address,
                    port=server.ssh_port,
                    username=server.ssh_username,
                    password=decrypt_credential(vault.encrypted_value) if vault.auth_type == "password" else None,
                    private_key=decrypt_credential(vault.encrypted_value) if vault.auth_type == "ssh_key" else None
                )
                snapshot = await ssh_client.snapshot()
                if snapshot:
                    used_source = "ssh"
            except Exception as e:
                log.error("ssh_ingest_error", server=server.name, error=str(e))

    if snapshot is None:
        await _mark_server_offline(server.id)
        return False

    async with AsyncSessionLocal() as db:
        try:
            await _ingest_host_metrics(db, server, snapshot, used_source)
            await _ingest_containers(db, server, snapshot)
            await _ingest_disk_metrics(db, server, snapshot)
            await _ingest_ports(db, server, snapshot)
            await db.commit()
        except Exception as e:
            log.error("ingest_error", server=server.name, error=str(e))
            await db.rollback()

    return True


async def _mark_server_offline(server_id: uuid.UUID):
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Server).where(Server.id == server_id))
        server = res.scalar_one_or_none()
        
        if server and server.status != "offline":
            prev_status = server.status
            server.status = "offline"
            server.last_check_at = datetime.now(timezone.utc)
            
            from app.models.infrastructure_event import InfrastructureEvent
            event = InfrastructureEvent(
                server_id=server.id,
                event_type="server_offline",
                source="server",
                severity="error",
                title="Server went offline",
                details={"old_status": prev_status, "new_status": "offline"}
            )
            db.add(event)
            await db.commit()

    msg = json.dumps({"type": "server_status", "server_id": str(server_id), "status": "offline"})
    await publish_metric("servers", msg)


async def _ingest_host_metrics(db: AsyncSession, server: Server, snapshot: dict, source: str | None = None):
    host = snapshot.get("host", snapshot) # fallback if flat dict
    net = snapshot.get("network", snapshot.get("interfaces", []))

    # Extract uptime_seconds from wherever the agent/SSH puts it
    uptime_seconds: int | None = None
    raw = snapshot.get("uptime_seconds") or host.get("uptime_seconds") or snapshot.get("uptime") or host.get("uptime")
    if isinstance(raw, (int, float)) and raw > 0:
        uptime_seconds = int(raw)
    elif isinstance(raw, str):
        try:
            val = int(raw.strip())
            if val > 0:
                uptime_seconds = val
        except ValueError:
            pass

    # Calculate network rate
    prev = _prev_net.get(str(server.id), {})
    rx_rate, tx_rate = _calc_net_rate(net, prev)
    _prev_net[str(server.id)] = {iface["name"]: iface for iface in net if "name" in iface}
    
    from app.redis_client import cache_set
    import json
    await cache_set(f"server:{server.id}:network", json.dumps({"interfaces": net}), ttl=45)

    cpu = host.get("cpu_percent", 0)
    ram_total = host.get("ram_total", 0)
    ram_used = host.get("ram_used", 0)
    ram_percent = (ram_used / ram_total * 100) if ram_total else 0

    # Determine status
    status = "online"
    if cpu > 80 or ram_percent > 85:
        status = "warning"
    if cpu > 90 or ram_percent > 95:
        status = "critical"
        
    prev_status = server.status

    docker_status = snapshot.get("docker_status", "UNKNOWN")

    now = datetime.now(timezone.utc)
    # Update server cached metrics
    await db.execute(
        update(Server)
        .where(Server.id == server.id)
        .values(
            status=status,
            docker_status=docker_status,
            last_seen=now,
            last_check_at=now,
            last_success_at=now,
            monitoring_source=source,
            last_cpu_percent=cpu,
            last_ram_percent=ram_percent,
            last_load_1=host.get("load_1"),
            **({"last_uptime_seconds": uptime_seconds} if uptime_seconds is not None else {}),
            **({"hostname": host.get("hostname")} if host.get("hostname") else {}),
            **({"os": host.get("os")} if host.get("os") not in (None, "Unknown") else {}),
            **({"architecture": host.get("architecture")} if host.get("architecture") not in (None, "Unknown") else {}),
            **({"cpu_cores": host.get("cpu_cores")} if host.get("cpu_cores") is not None else {}),
            **({"ram_total": host.get("ram_total")} if host.get("ram_total") is not None else {}),
        )
    )
    
    if prev_status and prev_status != status:
        from app.models.infrastructure_event import InfrastructureEvent
        severity = "info"
        if status == "warning": severity = "warning"
        elif status == "critical": severity = "critical"
        elif status == "offline": severity = "error"
        
        event = InfrastructureEvent(
            server_id=server.id,
            event_type=f"server_{status}",
            source="server",
            severity=severity,
            title=f"Server status changed to {status}",
            details={"old_status": prev_status, "new_status": status}
        )
        db.add(event)

    # Store time-series metric
    metric = ServerMetric(
        server_id=server.id,
        time=datetime.now(timezone.utc),
        cpu_percent=cpu,
        load_1=host.get("load_1"),
        load_5=host.get("load_5"),
        load_15=host.get("load_15"),
        cpu_cores=host.get("cpu_cores"),
        ram_total=ram_total,
        ram_used=ram_used,
        ram_cached=host.get("ram_cached"),
        ram_available=host.get("ram_available"),
        swap_total=host.get("swap_total"),
        swap_used=host.get("swap_used"),
        net_rx_rate=rx_rate,
        net_tx_rate=tx_rate,
    )
    db.add(metric)

    # Publish live update via Redis
    payload = json.dumps({
        "type": "server_metrics",
        "server_id": str(server.id),
        "data": {
            "cpu_percent": cpu,
            "ram_percent": round(ram_percent, 1),
            "ram_used": ram_used,
            "ram_total": ram_total,
            "load_1": host.get("load_1"),
            "load_5": host.get("load_5"),
            "load_15": host.get("load_15"),
            "net_rx_rate": rx_rate,
            "net_tx_rate": tx_rate,
            "status": status,
        },
    })
    await publish_metric(f"server:{server.id}", payload)
    await publish_metric("servers", payload)
    await cache_set(f"server:{server.id}:live", payload, ttl=30)


async def _ingest_containers(db: AsyncSession, server: Server, snapshot: dict):
    containers_data = snapshot.get("containers", [])
    stats_data = {s.get("full_id", s.get("id")): s for s in snapshot.get("container_stats", []) if "full_id" in s or "id" in s}

    for c_data in containers_data:
        docker_id = c_data.get("short_id", c_data.get("id", ""))[:12]
        full_id = c_data.get("full_id", c_data.get("id", ""))
        name = c_data.get("name", "").lstrip("/")
        status = c_data.get("state", c_data.get("status", "unknown")).lower()

        # Upsert container record
        result = await db.execute(
            select(Container).where(
                Container.server_id == server.id,
                Container.container_id == docker_id
            )
        )
        container = result.scalar_one_or_none()

        env_vars = c_data.get("env", [])
        masked_env = mask_env_vars(env_vars)

        if container is None:
            container = Container(
                server_id=server.id,
                container_id=docker_id,
                container_full_id=full_id,
                name=name,
                image=c_data.get("image"),
                network_mode=c_data.get("network_mode"),
                ports=c_data.get("ports"),
                volumes=c_data.get("volumes"),
                labels=c_data.get("labels"),
                env_vars_masked=masked_env,
            )
            db.add(container)
        else:
            container.name = name
            container.image = c_data.get("image", container.image)
            container.ports = c_data.get("ports", container.ports)
            container.labels = c_data.get("labels", container.labels)
            container.env_vars_masked = masked_env

        await db.flush()  # Ensure container.id is generated and available

        prev_status = container.status
        container.status = status
        container.restart_count = c_data.get("restart_count", 0)
        container.exit_code = c_data.get("exit_code")
        container.oom_killed = c_data.get("oom_killed", False)
        container.health_status = c_data.get("health_status")
        container.last_seen = datetime.now(timezone.utc)

        # Detect restart/stop events
        if prev_status and prev_status != status:
            event = ContainerEvent(
                server_id=server.id,
                container_db_id=container.id,
                container_name=name,
                event_type=_classify_event(status, c_data),
                exit_code=c_data.get("exit_code"),
                oom_killed=c_data.get("oom_killed", False),
                restart_count=c_data.get("restart_count", 0),
                occurred_at=datetime.now(timezone.utc),
            )
            db.add(event)

        # Stats
        stats = stats_data.get(full_id, stats_data.get(docker_id, {}))
        if stats:
            cpu_percent = stats.get("cpu_percent", 0)
            cores = snapshot.get("host", {}).get("cpu_cores", 1) or 1
            cpu_normalized = cpu_percent / cores

            mem_usage, mem_limit = _parse_io(stats.get("mem_usage_str", "0B / 0B"))
            mem_percent = stats.get("mem_percent", 0)

            # Rate calculation
            net_rx, net_tx = _parse_io(stats.get("net_io", "0B / 0B"))
            prev_c = _prev_container_net.get(full_id, {})
            net_rx_rate = _delta_rate(net_rx, prev_c.get("net_rx", 0))
            net_tx_rate = _delta_rate(net_tx, prev_c.get("net_tx", 0))
            _prev_container_net[full_id] = {"net_rx": net_rx, "net_tx": net_tx}

            block_read, block_write = _parse_io(stats.get("block_io", "0B / 0B"))
            prev_b = _prev_container_blk.get(full_id, {})
            blk_read_rate = _delta_rate(block_read, prev_b.get("block_read", 0))
            blk_write_rate = _delta_rate(block_write, prev_b.get("block_write", 0))
            _prev_container_blk[full_id] = {"block_read": block_read, "block_write": block_write}

            container.last_cpu_percent = cpu_percent
            container.last_mem_usage = mem_usage
            container.last_mem_limit = mem_limit

            cm = ContainerMetric(
                server_id=server.id,
                container_db_id=container.id,
                time=datetime.now(timezone.utc),
                cpu_percent=cpu_percent,
                cpu_normalized=round(cpu_normalized, 2),
                mem_usage=mem_usage,
                mem_limit=mem_limit,
                mem_percent=round(mem_percent, 1),
                net_rx_rate=net_rx_rate,
                net_tx_rate=net_tx_rate,
                block_read_rate=blk_read_rate,
                block_write_rate=blk_write_rate,
                pids=stats.get("pids", 0),
            )
            db.add(cm)

            # Publish container live metrics
            c_payload = json.dumps({
                "type": "container_stats",
                "server_id": str(server.id),
                "container_id": str(container.id),
                "container_name": name,
                "data": {
                    "cpu_percent": round(cpu_percent, 2),
                    "cpu_normalized": round(cpu_normalized, 2),
                    "mem_usage": mem_usage,
                    "mem_limit": mem_limit,
                    "mem_percent": round(mem_percent, 1),
                    "net_rx_rate": net_rx_rate,
                    "net_tx_rate": net_tx_rate,
                    "block_read_rate": blk_read_rate,
                    "block_write_rate": blk_write_rate,
                    "pids": stats.get("pids", 0),
                    "status": status,
                },
            })
            await publish_metric(f"container:{server.id}:{full_id}", c_payload)
            await cache_set(f"container:{server.id}:{full_id}:live", c_payload, ttl=30)
            await cache_set(f"container:{server.id}:{full_id}:status", status, ttl=30)


async def _ingest_disk_metrics(db: AsyncSession, server: Server, snapshot: dict):
    disks = snapshot.get("disks", [])
    max_pct = None
    for disk in disks:
        pct = disk.get("use_percent", 0)
        if max_pct is None or pct > max_pct:
            max_pct = pct
        dm = DiskMetric(
            server_id=server.id,
            time=datetime.now(timezone.utc),
            mount_point=disk.get("mount_point", "/"),
            filesystem=disk.get("filesystem"),
            total_bytes=_parse_disk_bytes(disk.get("total")),
            used_bytes=_parse_disk_bytes(disk.get("used")),
            free_bytes=_parse_disk_bytes(disk.get("free")),
            use_percent=pct,
            inode_total=disk.get("inode_total"),
            inode_used=disk.get("inode_used"),
            inode_percent=disk.get("inode_percent"),
        )
        db.add(dm)

    # Update server disk cache
    await db.execute(
        update(Server)
        .where(Server.id == server.id)
        .values(last_disk_percent=max_pct)
    )
    
    from app.redis_client import cache_set
    import json
    await cache_set(f"server:{server.id}:disk", json.dumps({"disks": disks}), ttl=45)


def _calc_net_rate(interfaces: list, prev: dict) -> tuple[float, float]:
    total_rx = sum(i.get("rx_bytes", 0) for i in interfaces)
    total_tx = sum(i.get("tx_bytes", 0) for i in interfaces)
    prev_rx = sum(v.get("rx_bytes", 0) for v in prev.values())
    prev_tx = sum(v.get("tx_bytes", 0) for v in prev.values())
    return max(0, total_rx - prev_rx), max(0, total_tx - prev_tx)


def _delta_rate(current: float, previous: float) -> float:
    delta = current - previous
    return max(0.0, delta)


def _classify_event(status: str, data: dict) -> str:
    if data.get("oom_killed"):
        return "oom_killed"
    if status == "exited" or status == "dead":
        return "stopped"
    if status == "running":
        return "started"
    if data.get("restart_count", 0) > 0:
        return "restarted"
    return "state_change"


# ─────────────────────────────────────────────────────────────────────────────
# PORT INGESTION  — read-only, no remote changes
# ─────────────────────────────────────────────────────────────────────────────

# Well-known service name lookup by port (process data wins when available)
_KNOWN_SERVICES: dict[int, str] = {
    20: "ftp-data", 21: "ftp", 22: "ssh", 23: "telnet",
    25: "smtp", 53: "dns", 80: "http/nginx", 110: "pop3",
    143: "imap", 389: "ldap", 443: "https/nginx",
    465: "smtps", 587: "smtp-submission", 993: "imaps", 995: "pop3s",
    1433: "sqlservr", 1521: "oracle", 3000: "node",
    3306: "mysqld", 3389: "rdp", 5000: "dev-server",
    5432: "postgres", 5672: "rabbitmq", 6379: "redis",
    6443: "kubernetes", 8080: "http-alt", 8443: "https-alt",
    8888: "jupyter", 9000: "php-fpm", 9090: "prometheus",
    9100: "node-exporter", 9200: "elasticsearch", 15672: "rabbitmq-mgmt",
    27017: "mongod", 27018: "mongod", 50070: "hdfs",
}

# Sensitive service patterns (by process name or known service) for attention rules
_SENSITIVE_PATTERNS = [
    "postgres", "mysqld", "mongod", "redis", "sqlservr", "oracle",
    "rabbitmq", "beam.smp", "docker", "kubelet", "elasticsearch",
]


def _parse_ss_output(raw: str) -> list[dict]:
    """
    Parse `ss -H -lntup` output into structured port records.
    Handles TCP, UDP, IPv4, IPv6 dual-stack addresses.
    Returns list of dicts with: protocol, state, port, bind_address, process_name, pid, raw_local
    """
    results = []
    seen_keys: set[str] = set()

    for line in (raw or "").splitlines():
        line = line.strip()
        if not line:
            continue
        # ss -H -lntup format:
        # tcp   LISTEN 0  128  0.0.0.0:22  0.0.0.0:*  users:(("sshd",pid=1023,fd=3))
        # udp   UNCONN 0  0    0.0.0.0:68  0.0.0.0:*
        parts = line.split()
        if len(parts) < 5:
            continue

        proto_raw = parts[0].lower()
        state_raw = parts[1].upper()

        # Normalize protocol/state
        if "6" in proto_raw:
            proto = proto_raw.replace("6", "")  # tcp6 → tcp
        else:
            proto = proto_raw
        proto = proto.split(":")[0] if ":" in proto else proto
        if proto not in ("tcp", "udp"):
            continue

        state_map = {
            "LISTEN": "LISTENING",
            "UNCONN": "UDP_LISTENING",
            "LISTENING": "LISTENING",
        }
        state = state_map.get(state_raw, state_raw)
        if state not in ("LISTENING", "UDP_LISTENING"):
            continue

        local_addr = parts[4]  # e.g. 0.0.0.0:22 or [::]:443 or *:68
        # Parse bind address and port
        bind_address, port = _parse_local_addr(local_addr)
        if port is None:
            continue

        # Parse process/PID from users:(("sshd",pid=1023,fd=3))
        process_name: str | None = None
        pid: int | None = None
        users_str = " ".join(parts[5:]) if len(parts) > 5 else ""
        if "users:" in users_str:
            import re as _re
            m = _re.search(r'users:\(\("([^"]+)",pid=(\d+)', users_str)
            if m:
                process_name = m.group(1)
                try:
                    pid = int(m.group(2))
                except ValueError:
                    pass

        # Deduplicate: same proto+bind+port may appear for IPv4 and IPv6 dual stack
        dedup_key = f"{proto}:{bind_address}:{port}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        # Classify bind scope
        bind_scope = _classify_bind_scope(bind_address)

        results.append({
            "protocol": proto,
            "state": state,
            "port": port,
            "bind_address": bind_address,
            "bind_scope": bind_scope,
            "process_name": process_name,
            "pid": pid,
        })

    return results


def _parse_local_addr(local: str) -> tuple[str, int | None]:
    """
    Parse local address field from ss output.
    Handles: 0.0.0.0:22, [::]:443, *:68, :::22, 127.0.0.1:5432
    """
    try:
        # IPv6 bracket form: [::1]:5432 or [::]:443
        if local.startswith("["):
            bracket_end = local.index("]")
            addr = local[1:bracket_end]
            port_str = local[bracket_end + 2:]  # skip ]:
            # Normalize IPv6 any
            if addr in ("::", "::0", "0:0:0:0:0:0:0:0"):
                addr = "0.0.0.0"
            elif addr in ("::1", "0:0:0:0:0:0:0:1"):
                addr = "127.0.0.1"
            return addr, int(port_str) if port_str.isdigit() else None

        # Wildcard: *:68
        if local.startswith("*:"):
            port_str = local[2:]
            return "0.0.0.0", int(port_str) if port_str.isdigit() else None

        # IPv6 without brackets: :::22 or ::1:5432
        if local.startswith(":::"):
            port_str = local[3:]
            return "0.0.0.0", int(port_str) if port_str.isdigit() else None

        # IPv4: 127.0.0.1:5432 or 0.0.0.0:22
        if ":" in local:
            parts = local.rsplit(":", 1)
            addr = parts[0] if parts[0] else "0.0.0.0"
            port_str = parts[1]
            return addr, int(port_str) if port_str.isdigit() else None

    except Exception:
        pass
    return "unknown", None


def _classify_bind_scope(bind_address: str) -> str:
    """Classify bind scope. Never labels as PUBLIC without verification."""
    if bind_address in ("127.0.0.1", "::1", "localhost"):
        return "LOCAL"
    if bind_address in ("0.0.0.0", "::", ""):
        return "WIDE"
    return "HOST"


def _service_name(process_name: str | None, port: int) -> str:
    """Prefer process name; fall back to well-known table."""
    if process_name:
        return process_name
    return _KNOWN_SERVICES.get(port, "unknown")


async def _ingest_ports(db: AsyncSession, server: Server, snapshot: dict):
    """
    Parse ss output from snapshot, track port history in Redis, emit InfrastructureEvents.
    Read-only: never modifies remote server.
    """
    from app.models.infrastructure_event import InfrastructureEvent
    from app.models.container import Container

    ports_raw = snapshot.get("ports_output", "")
    if not ports_raw:
        return  # No data — don't generate false events

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    server_id_str = str(server.id)

    # Parse current ss output
    raw_ports = _parse_ss_output(ports_raw)

    # Load container data for Docker port correlation (already in DB from _ingest_containers)
    containers_res = await db.execute(
        select(Container).where(Container.server_id == server.id, Container.status == "running")
    )
    containers = containers_res.scalars().all()

    # Build host_port → container map from Container.ports
    # Docker inspect stores dict: {"8080/tcp": [{"HostIp": "0.0.0.0", "HostPort": "9999"}]}
    # Docker ps stores string: "0.0.0.0:80->80/tcp, :::80->80/tcp"
    host_port_to_container: dict[str, dict] = {}
    for c in containers:
        c_ports = c.ports or {}
        if isinstance(c_ports, str):
            parsed_ports = {}
            for p_str in c_ports.split(","):
                p_str = p_str.strip()
                if not p_str or "->" not in p_str: continue
                host_part, container_part = p_str.split("->", 1)
                if ":" in host_part:
                    host_ip, host_port = host_part.rsplit(":", 1)
                    parsed_ports.setdefault(container_part, []).append({"HostIp": host_ip, "HostPort": host_port})
            c_ports = parsed_ports

        if not isinstance(c_ports, dict):
            c_ports = {}

        for container_port_proto, host_bindings in c_ports.items():
            if not host_bindings:
                continue
            # container_port_proto: "8080/tcp"
            cp_parts = container_port_proto.split("/")
            container_port = int(cp_parts[0]) if cp_parts[0].isdigit() else None
            if container_port is None:
                continue
            for binding in (host_bindings if isinstance(host_bindings, list) else []):
                try:
                    hp = int(binding.get("HostPort", "0"))
                    if hp > 0:
                        host_port_to_container[f"{hp}"] = {
                            "container_id": c.container_id,
                            "container_name": c.name,
                            "container_port": container_port,
                            "image": c.image,
                            "network_mode": c.network_mode,
                        }
                except Exception:
                    pass

    # Load previous port snapshot from Redis
    prev_cache_key = f"server:{server_id_str}:ports"
    prev_raw = await cache_get(prev_cache_key)
    prev_ports: dict[str, dict] = {}
    if prev_raw:
        try:
            prev_ports = json.loads(prev_raw)
        except Exception:
            pass

    # Build new port records
    new_ports: dict[str, dict] = {}
    for p in raw_ports:
        port_key = f"{p['protocol']}:{p['bind_address']}:{p['port']}"
        prev_entry = prev_ports.get(port_key, {})
        service = _service_name(p.get("process_name"), p["port"])

        # Correlate Docker
        container_info = host_port_to_container.get(str(p["port"]))
        source = "docker" if container_info else "host"

        entry = {
            "server_id": server_id_str,
            "server_name": server.name,
            "ip_address": server.ip_address,
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
            "first_seen": prev_entry.get("first_seen", now_iso),
            "last_seen": now_iso,
            "freshness": "live",
        }
        new_ports[port_key] = entry

    # Detect changes (only if we had a previous snapshot)
    if prev_ports:
        new_keys = set(new_ports.keys())
        prev_keys = set(prev_ports.keys())

        # Newly appeared ports
        for key in new_keys - prev_keys:
            p = new_ports[key]
            event = InfrastructureEvent(
                server_id=server.id,
                event_type="port_started",
                source="port",
                severity="info",
                title=f"Port {p['port']} started listening",
                details={
                    "port": p["port"],
                    "protocol": p["protocol"],
                    "bind_address": p["bind_address"],
                    "bind_scope": p["bind_scope"],
                    "service": p["service"],
                    "process": p.get("process_name"),
                },
                detected_at=now,
            )
            db.add(event)

        # Disappeared ports (only if server successfully reported — rule 71)
        for key in prev_keys - new_keys:
            p = prev_ports[key]
            event = InfrastructureEvent(
                server_id=server.id,
                event_type="port_stopped",
                source="port",
                severity="info",
                title=f"Port {p['port']} stopped listening",
                details={
                    "port": p["port"],
                    "protocol": p["protocol"],
                    "bind_address": p["bind_address"],
                    "bind_scope": p["bind_scope"],
                    "service": p.get("service"),
                },
                detected_at=now,
            )
            db.add(event)

        # Process changed on same port
        for key in new_keys & prev_keys:
            n = new_ports[key]
            o = prev_ports[key]
            if n.get("process_name") and o.get("process_name") and n["process_name"] != o["process_name"]:
                event = InfrastructureEvent(
                    server_id=server.id,
                    event_type="port_process_changed",
                    source="port",
                    severity="warning",
                    title=f"Port {n['port']} process changed",
                    details={
                        "port": n["port"],
                        "old_process": o["process_name"],
                        "new_process": n["process_name"],
                    },
                    old_value=o["process_name"],
                    new_value=n["process_name"],
                    detected_at=now,
                )
                db.add(event)

    # Cache new snapshot (long TTL since it's the full current state; scheduler runs every 30s)
    await cache_set(prev_cache_key, json.dumps(new_ports), ttl=120)

    log.debug("ports_ingested", server=server.name, count=len(new_ports))
