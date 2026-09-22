"""V2 workspace, billing, session and lead platform tables.

Revision ID: e2f0b4c19a10
Revises: d49952b6d733
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e2f0b4c19a10"
down_revision: Union[str, None] = "d49952b6d733"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("organizations", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("name", sa.String(160), nullable=False), sa.Column("slug", sa.String(180), nullable=False, unique=True), sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_table("organization_members", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True), sa.Column("invited_email", sa.String(255)), sa.Column("role", sa.String(30), nullable=False, server_default="viewer"), sa.Column("status", sa.String(30), nullable=False, server_default="active"), sa.Column("invitation_token_hash", sa.String(64)), sa.Column("invitation_expires_at", sa.DateTime(timezone=True)), sa.Column("joined_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("organization_id", "user_id", name="uq_org_member_user"))
    op.create_index("ix_org_member_org", "organization_members", ["organization_id"])
    op.create_index("ix_org_member_user", "organization_members", ["user_id"])
    op.create_table("subscriptions", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True), sa.Column("plan", sa.String(30), nullable=False, server_default="starter"), sa.Column("status", sa.String(30), nullable=False, server_default="active"), sa.Column("stripe_customer_id", sa.String(100), unique=True), sa.Column("stripe_subscription_id", sa.String(100), unique=True), sa.Column("current_period_end", sa.DateTime(timezone=True)), sa.Column("cancel_at_period_end", sa.Boolean(), server_default=sa.false(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("refresh_sessions", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("jti_hash", sa.String(64), nullable=False, unique=True), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True)), sa.Column("ip_address", sa.String(45)), sa.Column("user_agent", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("password_reset_tokens", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("used_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("contact_requests", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("first_name", sa.String(100), nullable=False), sa.Column("last_name", sa.String(100), nullable=False), sa.Column("email", sa.String(255), nullable=False), sa.Column("company", sa.String(180), nullable=False), sa.Column("topic", sa.String(40), nullable=False), sa.Column("message", sa.Text(), nullable=False), sa.Column("metadata_json", postgresql.JSONB()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    op.drop_table("contact_requests")
    op.drop_table("password_reset_tokens")
    op.drop_table("refresh_sessions")
    op.drop_table("subscriptions")
    op.drop_table("organization_members")
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")

