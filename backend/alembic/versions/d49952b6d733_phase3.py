"""phase3

Revision ID: d49952b6d733
Revises: 
Create Date: 2026-09-01 06:32:20.930068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd49952b6d733'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Infrastructure Events table
    op.create_table('infrastructure_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('server_id', sa.UUID(), nullable=False),
    sa.Column('container_id', sa.String(length=255), nullable=True),
    sa.Column('event_type', sa.String(length=100), nullable=False),
    sa.Column('source', sa.String(length=100), nullable=False),
    sa.Column('severity', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('old_value', sa.Text(), nullable=True),
    sa.Column('new_value', sa.Text(), nullable=True),
    sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_infrastructure_events_container_id'), 'infrastructure_events', ['container_id'], unique=False)
    op.create_index(op.f('ix_infrastructure_events_event_type'), 'infrastructure_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_infrastructure_events_server_id'), 'infrastructure_events', ['server_id'], unique=False)

    # 2. Create Nginx parsing tables
    op.create_table('nginx_configs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('server_id', sa.UUID(), nullable=True),
    sa.Column('enabled_path', sa.String(), nullable=True),
    sa.Column('source_path', sa.String(), nullable=True),
    sa.Column('config_hash', sa.String(), nullable=True),
    sa.Column('collected_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nginx_configs_id'), 'nginx_configs', ['id'], unique=False)

    op.create_table('nginx_server_blocks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('config_id', sa.Integer(), nullable=True),
    sa.Column('server_name', sa.String(), nullable=True),
    sa.Column('listen', sa.String(), nullable=True),
    sa.Column('ssl', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['config_id'], ['nginx_configs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nginx_server_blocks_id'), 'nginx_server_blocks', ['id'], unique=False)

    op.create_table('nginx_upstreams',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('config_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['config_id'], ['nginx_configs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nginx_upstreams_id'), 'nginx_upstreams', ['id'], unique=False)

    op.create_table('nginx_locations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('server_block_id', sa.Integer(), nullable=True),
    sa.Column('path', sa.String(), nullable=False),
    sa.Column('proxy_pass', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['server_block_id'], ['nginx_server_blocks.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nginx_locations_id'), 'nginx_locations', ['id'], unique=False)

    op.create_table('nginx_upstream_targets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('upstream_id', sa.Integer(), nullable=True),
    sa.Column('host', sa.String(), nullable=False),
    sa.Column('port', sa.Integer(), nullable=True),
    sa.Column('weight', sa.Integer(), nullable=True),
    sa.Column('backup', sa.Boolean(), nullable=True),
    sa.Column('down', sa.Boolean(), nullable=True),
    sa.Column('max_fails', sa.Integer(), nullable=True),
    sa.Column('fail_timeout', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['upstream_id'], ['nginx_upstreams.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nginx_upstream_targets_id'), 'nginx_upstream_targets', ['id'], unique=False)

    # 3. Add new columns to servers table safely
    op.add_column('servers', sa.Column('monitoring_mode', sa.String(length=20), nullable=True, server_default='auto'))
    op.add_column('servers', sa.Column('ssh_host_key', sa.String(length=255), nullable=True))
    op.add_column('servers', sa.Column('docker_status', sa.String(length=50), nullable=True, server_default='UNKNOWN'))
    op.add_column('servers', sa.Column('last_check_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('servers', sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('servers', sa.Column('monitoring_source', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('servers', 'monitoring_source')
    op.drop_column('servers', 'last_success_at')
    op.drop_column('servers', 'last_check_at')
    op.drop_column('servers', 'docker_status')
    op.drop_column('servers', 'ssh_host_key')
    op.drop_column('servers', 'monitoring_mode')
    
    op.drop_index(op.f('ix_nginx_upstream_targets_id'), table_name='nginx_upstream_targets')
    op.drop_table('nginx_upstream_targets')
    
    op.drop_index(op.f('ix_nginx_locations_id'), table_name='nginx_locations')
    op.drop_table('nginx_locations')
    
    op.drop_index(op.f('ix_nginx_upstreams_id'), table_name='nginx_upstreams')
    op.drop_table('nginx_upstreams')
    
    op.drop_index(op.f('ix_nginx_server_blocks_id'), table_name='nginx_server_blocks')
    op.drop_table('nginx_server_blocks')
    
    op.drop_index(op.f('ix_nginx_configs_id'), table_name='nginx_configs')
    op.drop_table('nginx_configs')
    
    op.drop_index(op.f('ix_infrastructure_events_server_id'), table_name='infrastructure_events')
    op.drop_index(op.f('ix_infrastructure_events_event_type'), table_name='infrastructure_events')
    op.drop_index(op.f('ix_infrastructure_events_container_id'), table_name='infrastructure_events')
    op.drop_table('infrastructure_events')
