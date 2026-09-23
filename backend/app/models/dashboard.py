"""Organization-scoped dashboards and read-only metric panels."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Dashboard(Base):
    __tablename__ = "dashboards"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_dashboard_org_slug"),
        CheckConstraint(
            "default_time_range IN ('15m','1h','6h','24h','7d','30d')",
            name="ck_dashboard_time_range",
        ),
        CheckConstraint(
            "refresh_interval_seconds IN (0,5,10,30,60,300)",
            name="ck_dashboard_refresh_interval",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dashboard_folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_time_range: Mapped[str] = mapped_column(String(30), nullable=False, default="1h")
    refresh_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DashboardFolder(Base):
    __tablename__ = "dashboard_folders"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_dashboard_folder_org_slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DashboardVariable(Base):
    __tablename__ = "dashboard_variables"
    __table_args__ = (
        UniqueConstraint("dashboard_id", "name", name="uq_dashboard_variable_name"),
        CheckConstraint(
            "variable_type IN ('custom','server','container','mount_point')",
            name="ck_dashboard_variable_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    variable_type: Mapped[str] = mapped_column(String(30), nullable=False, default="custom")
    options: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    default_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Panel(Base):
    __tablename__ = "dashboard_panels"
    __table_args__ = (
        CheckConstraint(
            "visualization IN ('time_series','stat','gauge','bar','table')",
            name="ck_panel_visualization",
        ),
        CheckConstraint(
            "metric_source IN ('server_metrics','container_metrics','disk_metrics')",
            name="ck_panel_metric_source",
        ),
        CheckConstraint(
            "aggregation IN ('avg','min','max','sum','count','p95')",
            name="ck_panel_aggregation",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    visualization: Mapped[str] = mapped_column(String(30), nullable=False)
    metric_source: Mapped[str] = mapped_column(String(40), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(60), nullable=False)
    aggregation: Mapped[str] = mapped_column(String(20), nullable=False, default="avg")
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    query_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    grid_position: Mapped[dict] = mapped_column(JSONB, nullable=False)
    display_options: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
