"""
APScheduler — background scheduled tasks for metric ingestion and alert evaluation.
"""
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

import structlog

log = structlog.get_logger()
scheduler = AsyncIOScheduler(timezone="UTC")


def start_scheduler():
    """Call this from FastAPI lifespan."""
    scheduler.add_job(
        _ingest_all_servers,
        trigger=IntervalTrigger(seconds=30),
        id="ingest_all",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.add_job(
        _evaluate_alerts,
        trigger=IntervalTrigger(seconds=30),
        id="alert_eval",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.add_job(
        _mark_stale_servers,
        trigger=IntervalTrigger(seconds=60),
        id="stale_check",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.add_job(
        _cleanup_old_metrics,
        trigger=IntervalTrigger(hours=6),
        id="cleanup",
        replace_existing=True,
    )
    scheduler.start()
    log.info("scheduler_started")


def stop_scheduler():
    scheduler.shutdown(wait=False)


async def _ingest_all_servers():
    """Poll ALL active servers (SSH + agent). One failure must not stop others."""
    from app.database import AsyncSessionLocal
    from app.models.server import Server
    from app.services.metrics_ingester import ingest_server

    try:
        async with AsyncSessionLocal() as db:
            # Fetch ALL active servers — not just agent ones
            result = await db.execute(
                select(Server).where(Server.is_active == True)
            )
            servers = result.scalars().all()

        if not servers:
            return

        log.info("ingest_cycle_start", server_count=len(servers))

        # Concurrently poll, but never let one crash the rest
        semaphore = asyncio.Semaphore(5)

        async def _safe_ingest(server):
            async with semaphore:
                try:
                    await asyncio.wait_for(ingest_server(server), timeout=25)
                except asyncio.TimeoutError:
                    log.warning("ingest_timeout", server=server.name)
                    from app.services.metrics_ingester import _mark_server_offline
                    await _mark_server_offline(server.id)
                except Exception as e:
                    log.error("ingest_error", server=server.name, error=str(e))
                    from app.services.metrics_ingester import _mark_server_offline
                    await _mark_server_offline(server.id)

        await asyncio.gather(*[_safe_ingest(s) for s in servers])
        log.info("ingest_cycle_done", server_count=len(servers))

    except Exception as e:
        log.error("ingest_job_critical_error", error=str(e))


async def _mark_stale_servers():
    """Mark servers STALE if no successful metric received in 2 minutes."""
    from app.database import AsyncSessionLocal
    from app.models.server import Server
    from sqlalchemy import update
    from datetime import datetime, timezone, timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=2)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Server)
            .where(
                Server.is_active == True,
                Server.status == "online",
                Server.last_success_at < cutoff,
            )
            .values(status="stale")
        )
        await db.commit()


async def _evaluate_alerts():
    from app.services.alert_engine import evaluate_all_rules
    try:
        await evaluate_all_rules()
    except Exception as e:
        log.error("alert_eval_error", error=str(e))


async def _cleanup_old_metrics():
    """Delete metrics older than 30 days."""
    from app.database import AsyncSessionLocal
    from app.models.metric import ServerMetric, ContainerMetric, DiskMetric
    from sqlalchemy import delete
    from datetime import datetime, timezone, timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    async with AsyncSessionLocal() as db:
        await db.execute(delete(ServerMetric).where(ServerMetric.time < cutoff))
        await db.execute(delete(ContainerMetric).where(ContainerMetric.time < cutoff))
        await db.execute(delete(DiskMetric).where(DiskMetric.time < cutoff))
        await db.commit()
    log.info("metrics_cleanup_done", cutoff=str(cutoff))
