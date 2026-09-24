"""Alert routes — list, acknowledge, rules CRUD."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.alert import Alert, AlertRule

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertRuleCreate(BaseModel):
    name: str
    target_type: str  # server, container
    metric: str       # cpu_percent, ram_percent, disk_percent
    operator: str     # gt, gte, lt, lte
    threshold: float
    duration_seconds: int = 0
    severity: str = "warning"
    notify_email: bool = True
    notify_telegram: bool = False


from app.models.server import Server
from app.models.container import Container
from app.models.alert import Alert, AlertRule

@router.get("")
async def list_alerts(
    env: Optional[str] = Query(None),
    server_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Alert, Server.name.label("server_name"), Container.name.label("container_name"), AlertRule.name.label("alert_name"))
        .outerjoin(Server, Alert.server_id == Server.id)
        .outerjoin(Container, Alert.container_db_id == Container.id)
        .outerjoin(AlertRule, Alert.rule_id == AlertRule.id)
        .order_by(desc(Alert.fired_at))
        .limit(limit)
    )
    if env and env.lower() not in ("all", "all environments", ""):
        query = query.where(func.lower(Server.environment) == env.lower())
    if server_id and server_id.lower() not in ("all", "all servers", ""):
        query = query.where(Alert.server_id == server_id)
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    
    result = await db.execute(query)
    rows = result.all()
    
    out = []
    for row in rows:
        alert, server_name, container_name, alert_name = row
        d = _alert_to_dict(alert)
        d["server_name"] = server_name
        d["container_name"] = container_name
        d["alert_name"] = alert_name or alert.title
        d["condition_started_at"] = alert.fired_at.isoformat()
        out.append(d)
        
    return out


@router.get("/summary")
async def alert_summary(
    env: Optional[str] = Query(None),
    server_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    base_query = select(func.count(Alert.id)).where(Alert.status == "active")
    
    if env and env.lower() not in ("all", "all environments", ""):
        base_query = base_query.outerjoin(Server, Alert.server_id == Server.id).where(func.lower(Server.environment) == env.lower())
    elif server_id and server_id.lower() not in ("all", "all servers", ""):
        # Avoid joining Server if not filtering by env, but if server_id we can just use Alert.server_id
        base_query = base_query.where(Alert.server_id == server_id)
        
    total = await db.execute(base_query)
    
    critical_query = base_query.where(Alert.severity == "critical")
    warning_query = base_query.where(Alert.severity == "warning")
    
    critical = await db.execute(critical_query)
    warning = await db.execute(warning_query)
    
    return {
        "active": total.scalar_one() or 0,
        "critical": critical.scalar_one() or 0,
        "warning": warning.scalar_one() or 0,
    }


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Alert acknowledged"}


@router.get("/rules")
async def list_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at))
    return [_rule_to_dict(r) for r in result.scalars().all()]


@router.post("/rules", status_code=201)
async def create_rule(body: AlertRuleCreate, db: AsyncSession = Depends(get_db)):
    rule = AlertRule(**body.model_dump())
    db.add(rule)
    await db.commit()
    return _rule_to_dict(rule)


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: str, body: AlertRuleCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in body.model_dump().items():
        setattr(rule, k, v)
    await db.commit()
    return _rule_to_dict(rule)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404)
    await db.delete(rule)
    await db.commit()


def _alert_to_dict(a: Alert) -> dict:
    return {
        "id": str(a.id),
        "severity": a.severity,
        "title": a.title,
        "message": a.message,
        "metric_name": a.metric_name,
        "current_value": a.current_value,
        "threshold": a.threshold,
        "status": a.status,
        "server_id": str(a.server_id) if a.server_id else None,
        "container_id": str(a.container_db_id) if a.container_db_id else None,
        "fired_at": a.fired_at.isoformat(),
        "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
    }


def _rule_to_dict(r: AlertRule) -> dict:
    return {
        "id": str(r.id),
        "name": r.name,
        "target_type": r.target_type,
        "metric": r.metric,
        "operator": r.operator,
        "threshold": r.threshold,
        "duration_seconds": r.duration_seconds,
        "severity": r.severity,
        "is_active": r.is_active,
        "notify_email": r.notify_email,
        "notify_telegram": r.notify_telegram,
        "created_at": r.created_at.isoformat(),
    }


@router.get("/cpu-spikes")
async def get_cpu_spikes(
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Alert, Server.name.label("server_name"), Container.name.label("container_name"))
        .outerjoin(Server, Alert.server_id == Server.id)
        .outerjoin(Container, Alert.container_db_id == Container.id)
        .outerjoin(AlertRule, Alert.rule_id == AlertRule.id)
        .where(func.lower(func.coalesce(Alert.metric_name, AlertRule.metric, "")).in_(["cpu", "cpu_percent"]))
        .order_by(desc(Alert.fired_at))
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    now = datetime.now(timezone.utc)
    return [_cpu_alert_to_spike(alert, server_name, container_name, now) for alert, server_name, container_name in rows]


def _cpu_alert_to_spike(alert: Alert, server_name: str | None, container_name: str | None, now: datetime) -> dict:
    fired_at = alert.fired_at
    if fired_at.tzinfo is None:
        fired_at = fired_at.replace(tzinfo=timezone.utc)
    ended_at = alert.resolved_at or now
    if ended_at.tzinfo is None:
        ended_at = ended_at.replace(tzinfo=timezone.utc)
    return {
        "id": str(alert.id),
        "timestamp": fired_at.isoformat(),
        "server_name": server_name or "Unknown server",
        "process_name": container_name or "Server CPU metric",
        "peak_usage": float(alert.current_value or 0),
        "duration_seconds": max(0, int((ended_at - fired_at).total_seconds())),
        "severity": (alert.severity or "warning").capitalize(),
        "status": alert.status,
    }
