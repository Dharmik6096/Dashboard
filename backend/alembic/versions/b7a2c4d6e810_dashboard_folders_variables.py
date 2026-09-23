"""Add dashboard folders and variables.

Revision ID: b7a2c4d6e810
Revises: 9f3b7e2d4a01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b7a2c4d6e810"
down_revision: Union[str, None] = "9f3b7e2d4a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboard_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(140), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "slug", name="uq_dashboard_folder_org_slug"),
    )
    op.create_index("ix_dashboard_folders_organization_id", "dashboard_folders", ["organization_id"])
    op.add_column("dashboards", sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_dashboards_folder_id", "dashboards", "dashboard_folders", ["folder_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_dashboards_folder_id", "dashboards", ["folder_id"])

    op.create_table(
        "dashboard_variables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("variable_type", sa.String(30), nullable=False, server_default="custom"),
        sa.Column("options", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("default_value", sa.String(255)),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("dashboard_id", "name", name="uq_dashboard_variable_name"),
        sa.CheckConstraint("variable_type IN ('custom','server','container','mount_point')", name="ck_dashboard_variable_type"),
    )
    op.create_index("ix_dashboard_variables_dashboard_id", "dashboard_variables", ["dashboard_id"])


def downgrade() -> None:
    op.drop_index("ix_dashboard_variables_dashboard_id", table_name="dashboard_variables")
    op.drop_table("dashboard_variables")
    op.drop_index("ix_dashboards_folder_id", table_name="dashboards")
    op.drop_constraint("fk_dashboards_folder_id", "dashboards", type_="foreignkey")
    op.drop_column("dashboards", "folder_id")
    op.drop_index("ix_dashboard_folders_organization_id", table_name="dashboard_folders")
    op.drop_table("dashboard_folders")
