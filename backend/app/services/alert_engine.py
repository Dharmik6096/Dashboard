"""
Alert Engine — evaluates alert rules against live metrics and fires alerts.
"""
import json
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.alert import Alert, AlertRule
from app.models.server import Server
from app.models.container import Container
from app.redis_client import publish_metric
from app.services.notification import send_alert_email, send_telegram_alert
from app.config import settings

log = structlog.get_logger()

# Dedup: track recently fired alerts to avoid spam
# key: (rule_id, server_id, container_id) → last fired timestamp
_fired_cache: dict[str, datetime] = {}
ALERT_COOLDOWN_SECONDS = 300  # 5 minutes


async def evaluate_all_rules():
    """Called by scheduler every 15 seconds."""
    async with AsyncSessionLocal() as db:
        # Get all active servers with their live metrics
        servers = (await db.execute(select(Server).where(Server.is_active == True))).scalars().all()
        rules = (await db.execute(select(AlertRule).where(AlertRule.is_active == True))).scalars().all()

        for server in servers:
            for rule in rules:
                if rule.target_type == "server":
                    await _evaluate_server_rule(db, rule, server)

        # Container rules
        containers = (await db.execute(select(Container))).scalars().all()
        for container in containers:
            for rule in rules:
                if rule.target_type == "container":
                    await _evaluate_container_rule(db, rule, container)

        await db.commit()


async def _evaluate_server_rule(db: AsyncSession, rule: AlertRule, server: Server):
    value = None
    if rule.metric == "cpu_percent":
        value = server.last_cpu_percent
    elif rule.metric == "ram_percent":
        value = server.last_ram_percent
    elif rule.metric == "disk_percent":
        value = server.last_disk_percent

    if value is None:
        return

    if _check_threshold(value, rule.operator, rule.threshold):
        existing = (await db.execute(select(Alert).where(
            Alert.rule_id == rule.id, Alert.server_id == server.id, Alert.container_db_id == None, Alert.status.in_(["active", "acknowledged"])
        ))).scalars().first()
        
        if existing:
            existing.current_value = value
            existing.message = f"Server {server.name} {rule.metric} is {value:.1f}% (threshold: {rule.threshold}%)"
            return
            
        cache_key = f"{rule.id}:{server.id}:server"
        if _is_cooldown_active(cache_key):
            return

        alert = Alert(
            rule_id=rule.id,
            server_id=server.id,
            severity=rule.severity,
            title=f"{server.name}: {rule.metric.replace('_', ' ').title()} {rule.operator} {rule.threshold}%",
            message=f"Server {server.name} {rule.metric} is {value:.1f}% (threshold: {rule.threshold}%)",
            metric_name=rule.metric,
            current_value=value,
            threshold=rule.threshold,
            fired_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        _fired_cache[cache_key] = datetime.now(timezone.utc)

        # Push to WebSocket
        await publish_metric("alerts", json.dumps({
            "type": "alert",
            "severity": rule.severity,
            "title": alert.title,
            "message": alert.message,
            "server_id": str(server.id),
        }))

        # Send email notification
        if rule.notify_email and settings.GMAIL_SENDER:
            await send_alert_email(
                to_email=settings.GMAIL_DEFAULT_RECIPIENT,
                severity=rule.severity,
                title=alert.title,
                message=alert.message,
                server_name=server.name,
                current_value=value,
                threshold=rule.threshold,
                metric_name=rule.metric,
                fired_at=alert.fired_at,
            )

        if rule.notify_telegram:
            await send_telegram_alert(
                message=f"*{server.name}*\n{rule.metric}: {value:.1f}% (threshold: {rule.threshold}%)",
                severity=rule.severity,
            )

        log.info("alert_fired", server=server.name, rule=rule.name, value=value)
    else:
        # Auto-resolve
        active_alerts = (await db.execute(select(Alert).where(
            Alert.rule_id == rule.id, Alert.server_id == server.id, Alert.container_db_id == None, Alert.status.in_(["active", "acknowledged"])
        ))).scalars().all()
        for a in active_alerts:
            a.status = "resolved"
            a.resolved_at = datetime.now(timezone.utc)
            log.info("alert_resolved", alert_id=a.id, server=server.name)


async def _evaluate_container_rule(db: AsyncSession, rule: AlertRule, container: Container):
    value = None
    if rule.metric == "cpu_percent":
        value = container.last_cpu_percent
    elif rule.metric == "ram_percent":
        if container.last_mem_usage and container.last_mem_limit:
            value = container.last_mem_usage / container.last_mem_limit * 100

    if value is None:
        return

    if _check_threshold(value, rule.operator, rule.threshold):
        existing = (await db.execute(select(Alert).where(
            Alert.rule_id == rule.id, Alert.server_id == container.server_id, Alert.container_db_id == container.id, Alert.status.in_(["active", "acknowledged"])
        ))).scalars().first()
        
        server_result = await db.execute(select(Server).where(Server.id == container.server_id))
        server = server_result.scalar_one_or_none()
        server_name = server.name if server else str(container.server_id)
        
        if existing:
            existing.current_value = value
            existing.message = f"Container {container.name} on {server_name} {rule.metric} is {value:.1f}% (threshold: {rule.threshold}%)"
            return
            
        cache_key = f"{rule.id}:{container.id}:container"
        if _is_cooldown_active(cache_key):
            return

        alert = Alert(
            rule_id=rule.id,
            server_id=container.server_id,
            container_db_id=container.id,
            severity=rule.severity,
            title=f"{container.name}: {rule.metric.replace('_', ' ').title()} {rule.operator} {rule.threshold}%",
            message=f"Container {container.name} on {server_name} {rule.metric} is {value:.1f}% (threshold: {rule.threshold}%)",
            metric_name=rule.metric,
            current_value=value,
            threshold=rule.threshold,
            fired_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        _fired_cache[cache_key] = datetime.now(timezone.utc)

        await publish_metric("alerts", json.dumps({
            "type": "alert",
            "severity": rule.severity,
            "title": alert.title,
            "message": alert.message,
            "server_id": str(container.server_id),
            "container_id": str(container.id),
        }))

        if rule.notify_email and settings.GMAIL_SENDER:
            await send_alert_email(
                to_email=settings.GMAIL_DEFAULT_RECIPIENT,
                severity=rule.severity,
                title=alert.title,
                message=alert.message,
                server_name=server_name,
                container_name=container.name,
                current_value=value,
                threshold=rule.threshold,
                metric_name=rule.metric,
                fired_at=alert.fired_at,
            )

        if rule.notify_telegram:
            await send_telegram_alert(
                message=f"*{server_name}* / *{container.name}*\n{rule.metric}: {value:.1f}%",
                severity=rule.severity,
            )
    else:
        # Auto-resolve
        active_alerts = (await db.execute(select(Alert).where(
            Alert.rule_id == rule.id, Alert.server_id == container.server_id, Alert.container_db_id == container.id, Alert.status.in_(["active", "acknowledged"])
        ))).scalars().all()
        for a in active_alerts:
            a.status = "resolved"
            a.resolved_at = datetime.now(timezone.utc)
            log.info("alert_resolved", alert_id=a.id, container=container.name)


def _check_threshold(value: float, operator: str, threshold: float) -> bool:
    ops = {"gt": value > threshold, "gte": value >= threshold, "lt": value < threshold, "lte": value <= threshold}
    return ops.get(operator, False)


def _is_cooldown_active(cache_key: str) -> bool:
    last = _fired_cache.get(cache_key)
    if last is None:
        return False
    elapsed = (datetime.now(timezone.utc) - last).total_seconds()
    return elapsed < ALERT_COOLDOWN_SECONDS
