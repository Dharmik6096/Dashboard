"""Diagnostics service — read-only investigation of high CPU/load."""
from app.services.agent_client import AgentClient
from app.models.server import Server
from app.models.container import Container
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


async def investigate_server(server: Server, db: AsyncSession) -> dict:
    """Gather full diagnostic snapshot for a server."""
    if not server.agent_url:
        return {"error": "No agent configured for this server"}

    client = AgentClient(server.agent_url, server.agent_token_hash or "", server.name)
    snapshot = await client.snapshot()
    if not snapshot:
        return {"error": "Agent unreachable"}

    host = snapshot.get("host", {})
    containers = snapshot.get("container_stats", [])

    # Find highest CPU container
    top_container = max(containers, key=lambda c: c.get("cpu_percent", 0), default=None)

    observations = []
    confirmed_facts = []
    possible_causes = []
    recommended_checks = []

    cpu = host.get("cpu_percent", 0)
    load1 = host.get("load_1", 0)
    cores = host.get("cpu_cores", 1)

    confirmed_facts.append(f"Server CPU: {cpu:.1f}%")
    confirmed_facts.append(f"Load average (1/5/15): {load1:.2f} / {host.get('load_5',0):.2f} / {host.get('load_15',0):.2f}")
    confirmed_facts.append(f"CPU Cores: {cores}")

    ram_used = host.get("ram_used", 0)
    ram_total = host.get("ram_total", 1)
    ram_pct = ram_used / ram_total * 100 if ram_total else 0
    confirmed_facts.append(f"RAM: {ram_pct:.1f}% ({_bytes(ram_used)} / {_bytes(ram_total)})")

    if top_container:
        container_cpu = top_container.get("cpu_percent", 0)
        if container_cpu > 50:
            observations.append(f"Container '{top_container.get('name')}' is using {container_cpu:.1f}% CPU")

    # Get container processes for highest CPU container
    top_proc_info = None
    if top_container:
        procs = await client.container_top(top_container.get("id", "")) or {}
        proc_list = procs.get("processes", [])
        if proc_list:
            top_proc = max(proc_list, key=lambda p: p.get("cpu_percent", 0), default=None)
            if top_proc:
                top_proc_info = top_proc
                observations.append(
                    f"Highest CPU process: {top_proc.get('command', 'unknown')} "
                    f"(PID {top_proc.get('pid')}, CPU {top_proc.get('cpu_percent', 0):.1f}%)"
                )
                possible_causes.append(
                    f"Correlated: CPU increase may be related to {top_proc.get('command', 'unknown')}"
                )

    # Check disk
    disks = snapshot.get("disks", [])
    for disk in disks:
        if disk.get("use_percent", 0) > 85:
            confirmed_facts.append(f"Disk {disk.get('mount_point')} at {disk.get('use_percent')}%")
            possible_causes.append(f"Disk pressure on {disk.get('mount_point')} may cause I/O wait")

    recommended_checks.append("Check container logs for errors")
    recommended_checks.append("Review cron job schedules for overlap")
    if ram_pct > 80:
        recommended_checks.append("Consider increasing RAM or reducing container memory limits")

    return {
        "server_name": server.name,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "confirmed_facts": confirmed_facts,
        "observations": observations,
        "possible_causes": possible_causes,
        "recommended_checks": recommended_checks,
        "top_container": top_container,
        "top_process": top_proc_info,
        "raw_snapshot_summary": {
            "cpu_percent": cpu,
            "ram_percent": round(ram_pct, 1),
            "container_count": len(containers),
        },
    }


def _bytes(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024:
            return f"{b:.1f}{unit}"
        b /= 1024
    return f"{b:.1f}PB"
