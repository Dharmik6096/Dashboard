"""Add organization-scoped dashboards and metric panels.

Revision ID: 9f3b7e2d4a01
Revises: e2f0b4c19a10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "9f3b7e2d4a01"
down_revision: Union[str, None] = "e2f0b4c19a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("slug", sa.String(180), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("default_time_range", sa.String(30), nullable=False, server_default="1h"),
        sa.Column("refresh_interval_seconds", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "slug", name="uq_dashboard_org_slug"),
        sa.CheckConstraint("default_time_range IN ('15m','1h','6h','24h','7d','30d')", name="ck_dashboard_time_range"),
        sa.CheckConstraint("refresh_interval_seconds IN (0,5,10,30,60,300)", name="ck_dashboard_refresh_interval"),
    )
    op.create_index("ix_dashboards_organization_id", "dashboards", ["organization_id"])

    op.create_table(
        "dashboard_panels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("visualization", sa.String(30), nullable=False),
        sa.Column("metric_source", sa.String(40), nullable=False),
        sa.Column("metric_name", sa.String(60), nullable=False),
        sa.Column("aggregation", sa.String(20), nullable=False, server_default="avg"),
        sa.Column("unit", sa.String(30)),
        sa.Column("query_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("grid_position", postgresql.JSONB(), nullable=False),
        sa.Column("display_options", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("visualization IN ('time_series','stat','gauge','bar','table')", name="ck_panel_visualization"),
        sa.CheckConstraint("metric_source IN ('server_metrics','container_metrics','disk_metrics')", name="ck_panel_metric_source"),
        sa.CheckConstraint("aggregation IN ('avg','min','max','sum','count','p95')", name="ck_panel_aggregation"),
    )
    op.create_index("ix_dashboard_panels_dashboard_id", "dashboard_panels", ["dashboard_id"])


def downgrade() -> None:
    op.drop_index("ix_dashboard_panels_dashboard_id", table_name="dashboard_panels")
    op.drop_table("dashboard_panels")
    op.drop_index("ix_dashboards_organization_id", table_name="dashboards")
    op.drop_table("dashboards")
