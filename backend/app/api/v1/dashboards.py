"""Organization-scoped dashboard and panel CRUD.

Panel definitions select from an allowlist of metrics. They never accept raw SQL,
shell commands, or any operation that mutates monitored infrastructure.
"""
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.api.v1.organizations import current_membership
from app.database import get_db
from app.models.audit import AuditLog
from app.models.dashboard import Dashboard, Panel
from app.models.metric import ContainerMetric, DiskMetric, ServerMetric
from app.models.platform import OrganizationMember
from app.models.user import User

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

EDITOR_ROLES = {"owner", "admin", "analyst"}
TIME_RANGES = {"15m", "1h", "6h", "24h", "7d", "30d"}
REFRESH_INTERVALS = {0, 5, 10, 30, 60, 300}
METRICS = {
    "server_metrics": {
        "cpu_percent", "ram_percent", "load_1", "net_rx_rate", "net_tx_rate",
    },
    "container_metrics": {
        "cpu_percent", "mem_percent", "net_rx_rate", "net_tx_rate",
        "block_read_rate", "block_write_rate", "pids",
    },
    "disk_metrics": {"use_percent", "used_bytes", "free_bytes"},
}
TIME_RANGE_DELTAS = {
    "15m": timedelta(minutes=15),
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}
BUCKET_SECONDS = {
    "15m": 5,
    "1h": 15,
    "6h": 120,
    "24h": 600,
    "7d": 3600,
    "30d": 14400,
}
GROUPS_BY_SOURCE = {
    "server_metrics": {"none", "server"},
    "container_metrics": {"none", "server", "container"},
    "disk_metrics": {"none", "server", "mount_point"},
}
METRIC_MODELS = {
    "server_metrics": ServerMetric,
    "container_metrics": ContainerMetric,
    "disk_metrics": DiskMetric,
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DashboardCreate(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    default_time_range: str = "1h"
    refresh_interval_seconds: int = 30

    @model_validator(mode="after")
    def validate_preferences(self):
        if self.default_time_range not in TIME_RANGES:
            raise ValueError("Unsupported default time range")
        if self.refresh_interval_seconds not in REFRESH_INTERVALS:
            raise ValueError("Unsupported refresh interval")
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Dashboard title is required")
        return self


class DashboardUpdate(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    default_time_range: str | None = None
    refresh_interval_seconds: int | None = None

    @model_validator(mode="after")
    def validate_preferences(self):
        if not self.model_fields_set:
            raise ValueError("At least one dashboard field is required")
        if self.default_time_range is not None and self.default_time_range not in TIME_RANGES:
            raise ValueError("Unsupported default time range")
        if self.refresh_interval_seconds is not None and self.refresh_interval_seconds not in REFRESH_INTERVALS:
            raise ValueError("Unsupported refresh interval")
        if self.title is not None:
            self.title = self.title.strip()
            if not self.title:
                raise ValueError("Dashboard title is required")
        return self


class GridPosition(StrictModel):
    x: int = Field(ge=0, le=23)
    y: int = Field(ge=0, le=10000)
    width: int = Field(ge=1, le=24)
    height: int = Field(ge=1, le=20)

    @model_validator(mode="after")
    def stay_inside_grid(self):
        if self.x + self.width > 24:
            raise ValueError("Panel must fit inside the 24-column grid")
        return self


class PanelQueryConfig(StrictModel):
    server_id: uuid.UUID | None = None
    container_id: uuid.UUID | None = None
    mount_point: str | None = Field(default=None, max_length=255)
    group_by: Literal["none", "server", "container", "mount_point"] = "none"


class PanelDisplayOptions(StrictModel):
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    decimals: int = Field(default=1, ge=0, le=6)
    show_legend: bool = True
    show_points: bool = False


class PanelCreate(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    visualization: Literal["time_series", "stat", "gauge", "bar", "table"]
    metric_source: Literal["server_metrics", "container_metrics", "disk_metrics"]
    metric_name: str = Field(min_length=1, max_length=60)
    aggregation: Literal["avg", "min", "max", "sum", "count", "p95"] = "avg"
    unit: str | None = Field(default=None, max_length=30)
    query_config: PanelQueryConfig = Field(default_factory=PanelQueryConfig)
    grid_position: GridPosition
    display_options: PanelDisplayOptions = Field(default_factory=PanelDisplayOptions)
    sort_order: int = Field(default=0, ge=0, le=10000)

    @model_validator(mode="after")
    def validate_metric(self):
        _validate_metric(self.metric_source, self.metric_name)
        _validate_query_config(self.metric_source, self.query_config)
        self.title = self.title.strip()
        return self


class PanelUpdate(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    visualization: Literal["time_series", "stat", "gauge", "bar", "table"] | None = None
    metric_source: Literal["server_metrics", "container_metrics", "disk_metrics"] | None = None
    metric_name: str | None = Field(default=None, min_length=1, max_length=60)
    aggregation: Literal["avg", "min", "max", "sum", "count", "p95"] | None = None
    unit: str | None = Field(default=None, max_length=30)
    query_config: PanelQueryConfig | None = None
    grid_position: GridPosition | None = None
    display_options: PanelDisplayOptions | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10000)

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one panel field is required")
        if self.title is not None:
            self.title = self.title.strip()
            if not self.title:
                raise ValueError("Panel title is required")
        return self


def require_editor(membership: OrganizationMember) -> None:
    if membership.role not in EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Dashboard editor access required")


def _validate_metric(metric_source: str, metric_name: str) -> None:
    if metric_source not in METRICS or metric_name not in METRICS[metric_source]:
        raise ValueError("Metric is not available for this source")


def _validate_query_config(metric_source: str, query_config: PanelQueryConfig | dict) -> None:
    config = query_config if isinstance(query_config, PanelQueryConfig) else PanelQueryConfig.model_validate(query_config)
    if config.group_by not in GROUPS_BY_SOURCE[metric_source]:
        raise ValueError(f"group_by={config.group_by} is not available for {metric_source}")
    if config.container_id and metric_source != "container_metrics":
        raise ValueError("container_id is only available for container metrics")
    if config.mount_point and metric_source != "disk_metrics":
        raise ValueError("mount_point is only available for disk metrics")


def _metric_expression(panel: Panel):
    model = METRIC_MODELS[panel.metric_source]
    if panel.metric_source == "server_metrics" and panel.metric_name == "ram_percent":
        return ServerMetric.ram_used * 100.0 / func.nullif(ServerMetric.ram_total, 0)
    return getattr(model, panel.metric_name)


def _aggregate_expression(panel: Panel, metric):
    if panel.aggregation == "p95":
        return func.percentile_cont(0.95).within_group(metric)
    return getattr(func, panel.aggregation)(metric)


def _series_column(panel: Panel):
    group_by = (panel.query_config or {}).get("group_by", "none")
    if group_by == "server":
        return METRIC_MODELS[panel.metric_source].server_id
    if group_by == "container":
        return ContainerMetric.container_db_id
    if group_by == "mount_point":
        return DiskMetric.mount_point
    return None


def _series_label(group_by: str, key: object | None) -> str:
    if key is None:
        return "All targets"
    return f"{group_by.replace('_', ' ').title()} {key}"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:150] or "dashboard"


def _dashboard_dict(dashboard: Dashboard, panel_count: int | None = None) -> dict:
    data = {
        "id": str(dashboard.id),
        "title": dashboard.title,
        "slug": dashboard.slug,
        "description": dashboard.description,
        "default_time_range": dashboard.default_time_range,
        "refresh_interval_seconds": dashboard.refresh_interval_seconds,
        "created_at": dashboard.created_at.isoformat() if dashboard.created_at else None,
        "updated_at": dashboard.updated_at.isoformat() if dashboard.updated_at else None,
    }
    if panel_count is not None:
        data["panel_count"] = panel_count
    return data


def _panel_dict(panel: Panel) -> dict:
    return {
        "id": str(panel.id),
        "dashboard_id": str(panel.dashboard_id),
        "title": panel.title,
        "description": panel.description,
        "visualization": panel.visualization,
        "metric_source": panel.metric_source,
        "metric_name": panel.metric_name,
        "aggregation": panel.aggregation,
        "unit": panel.unit,
        "query_config": panel.query_config,
        "grid_position": panel.grid_position,
        "display_options": panel.display_options,
        "sort_order": panel.sort_order,
        "created_at": panel.created_at.isoformat() if panel.created_at else None,
        "updated_at": panel.updated_at.isoformat() if panel.updated_at else None,
    }


async def _organization_dashboard(
    dashboard_id: uuid.UUID, membership: OrganizationMember, db: AsyncSession
) -> Dashboard:
    dashboard = (
        await db.execute(
            select(Dashboard).where(
                Dashboard.id == dashboard_id,
                Dashboard.organization_id == membership.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


def _audit(request: Request, user: User, action: str, resource_id: uuid.UUID, details: dict | None = None) -> AuditLog:
    return AuditLog(
        user_id=user.id,
        action=action,
        resource_type="dashboard",
        resource_id=str(resource_id),
        ip_address=request.client.host if request.client else None,
        details=details,
    )


@router.get("")
async def list_dashboards(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    rows = (
        await db.execute(
            select(Dashboard, func.count(Panel.id))
            .outerjoin(Panel, Panel.dashboard_id == Dashboard.id)
            .where(Dashboard.organization_id == membership.organization_id)
            .group_by(Dashboard.id)
            .order_by(Dashboard.updated_at.desc(), Dashboard.title)
        )
    ).all()
    return [_dashboard_dict(dashboard, panel_count) for dashboard, panel_count in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    request: Request,
    body: DashboardCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    require_editor(membership)
    base_slug = _slug(body.title)
    slug = base_slug
    while (
        await db.execute(
            select(Dashboard.id).where(
                Dashboard.organization_id == membership.organization_id,
                Dashboard.slug == slug,
            )
        )
    ).scalar_one_or_none():
        slug = f"{base_slug}-{secrets.token_hex(2)}"
    dashboard = Dashboard(
        organization_id=membership.organization_id,
        created_by=user.id,
        slug=slug,
        **body.model_dump(),
    )
    db.add(dashboard)
    await db.flush()
    db.add(_audit(request, user, "dashboard.created", dashboard.id, {"title": dashboard.title}))
    await db.commit()
    await db.refresh(dashboard)
    return _dashboard_dict(dashboard, 0)


@router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    panels = (
        await db.execute(
            select(Panel).where(Panel.dashboard_id == dashboard.id).order_by(Panel.sort_order, Panel.created_at)
        )
    ).scalars().all()
    return {**_dashboard_dict(dashboard, len(panels)), "panels": [_panel_dict(panel) for panel in panels]}


@router.get("/{dashboard_id}/panels/{panel_id}/data")
async def get_panel_data(
    dashboard_id: uuid.UUID,
    panel_id: uuid.UUID,
    time_range: Literal["15m", "1h", "6h", "24h", "7d", "30d"] | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return downsampled, read-only time-series values for one saved panel."""
    membership = await current_membership(user, db)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    panel = (
        await db.execute(select(Panel).where(Panel.id == panel_id, Panel.dashboard_id == dashboard.id))
    ).scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    try:
        _validate_metric(panel.metric_source, panel.metric_name)
        _validate_query_config(panel.metric_source, panel.query_config or {})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    selected_range = time_range or dashboard.default_time_range
    model = METRIC_MODELS[panel.metric_source]
    metric = _metric_expression(panel)
    bucket_seconds = BUCKET_SECONDS[selected_range]
    bucket = func.time_bucket(timedelta(seconds=bucket_seconds), model.time).label("bucket")
    value = _aggregate_expression(panel, metric).label("value")
    series_column = _series_column(panel)
    columns = [bucket, value]
    if series_column is not None:
        columns.append(series_column.label("series_key"))

    query = select(*columns).where(
        model.time >= datetime.now(timezone.utc) - TIME_RANGE_DELTAS[selected_range],
        metric.is_not(None),
    )
    config = PanelQueryConfig.model_validate(panel.query_config or {})
    if config.server_id:
        query = query.where(model.server_id == config.server_id)
    if config.container_id:
        query = query.where(ContainerMetric.container_db_id == config.container_id)
    if config.mount_point:
        query = query.where(DiskMetric.mount_point == config.mount_point)

    group_columns = [bucket]
    if series_column is not None:
        group_columns.append(series_column)
    query = query.group_by(*group_columns).order_by(*group_columns)
    rows = (await db.execute(query)).all()

    group_by = config.group_by
    series: dict[str, dict] = {}
    for row in rows:
        key_value = row[2] if series_column is not None else None
        key = str(key_value) if key_value is not None else "all"
        item = series.setdefault(key, {
            "key": key,
            "label": _series_label(group_by, key_value),
            "points": [],
        })
        item["points"].append({
            "time": row[0].isoformat(),
            "value": round(float(row[1]), 6) if row[1] is not None else None,
        })

    return {
        "panel_id": str(panel.id),
        "metric_source": panel.metric_source,
        "metric_name": panel.metric_name,
        "aggregation": panel.aggregation,
        "time_range": selected_range,
        "bucket_seconds": bucket_seconds,
        "series": list(series.values()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.patch("/{dashboard_id}")
async def update_dashboard(
    request: Request,
    dashboard_id: uuid.UUID,
    body: DashboardUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    require_editor(membership)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    changes = body.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(dashboard, key, value)
    dashboard.updated_at = datetime.now(timezone.utc)
    db.add(_audit(request, user, "dashboard.updated", dashboard.id, {"fields": sorted(changes)}))
    await db.commit()
    await db.refresh(dashboard)
    return _dashboard_dict(dashboard)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    request: Request,
    dashboard_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    require_editor(membership)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    db.add(_audit(request, user, "dashboard.deleted", dashboard.id, {"title": dashboard.title}))
    await db.delete(dashboard)
    await db.commit()


@router.post("/{dashboard_id}/panels", status_code=status.HTTP_201_CREATED)
async def create_panel(
    request: Request,
    dashboard_id: uuid.UUID,
    body: PanelCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    require_editor(membership)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    payload = body.model_dump(mode="json")
    panel = Panel(dashboard_id=dashboard.id, **payload)
    db.add(panel)
    await db.flush()
    dashboard.updated_at = datetime.now(timezone.utc)
    db.add(_audit(request, user, "dashboard.panel_created", dashboard.id, {"panel_id": str(panel.id)}))
    await db.commit()
    await db.refresh(panel)
    return _panel_dict(panel)


@router.patch("/{dashboard_id}/panels/{panel_id}")
async def update_panel(
    request: Request,
    dashboard_id: uuid.UUID,
    panel_id: uuid.UUID,
    body: PanelUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    require_editor(membership)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    panel = (
        await db.execute(select(Panel).where(Panel.id == panel_id, Panel.dashboard_id == dashboard.id))
    ).scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    changes = body.model_dump(mode="json", exclude_unset=True)
    source = changes.get("metric_source", panel.metric_source)
    metric = changes.get("metric_name", panel.metric_name)
    query_config = changes.get("query_config", panel.query_config or {})
    try:
        _validate_metric(source, metric)
        _validate_query_config(source, query_config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    for key, value in changes.items():
        setattr(panel, key, value)
    panel.updated_at = datetime.now(timezone.utc)
    dashboard.updated_at = panel.updated_at
    db.add(_audit(request, user, "dashboard.panel_updated", dashboard.id, {"panel_id": str(panel.id), "fields": sorted(changes)}))
    await db.commit()
    await db.refresh(panel)
    return _panel_dict(panel)


@router.delete("/{dashboard_id}/panels/{panel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_panel(
    request: Request,
    dashboard_id: uuid.UUID,
    panel_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await current_membership(user, db)
    require_editor(membership)
    dashboard = await _organization_dashboard(dashboard_id, membership, db)
    panel = (
        await db.execute(select(Panel).where(Panel.id == panel_id, Panel.dashboard_id == dashboard.id))
    ).scalar_one_or_none()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    db.add(_audit(request, user, "dashboard.panel_deleted", dashboard.id, {"panel_id": str(panel.id)}))
    await db.delete(panel)
    dashboard.updated_at = datetime.now(timezone.utc)
    await db.commit()
