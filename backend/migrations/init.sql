-- DevOps Dashboard — PostgreSQL Schema Init
-- Runs automatically on first postgres container start

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- V2 commercial workspace model
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) UNIQUE NOT NULL, is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, invited_email VARCHAR(255), role VARCHAR(30) NOT NULL DEFAULT 'viewer',
    status VARCHAR(30) NOT NULL DEFAULT 'active', invitation_token_hash VARCHAR(64), invitation_expires_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan VARCHAR(30) NOT NULL DEFAULT 'starter', status VARCHAR(30) NOT NULL DEFAULT 'active', stripe_customer_id VARCHAR(100) UNIQUE,
    stripe_subscription_id VARCHAR(100) UNIQUE, current_period_end TIMESTAMPTZ, cancel_at_period_end BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS refresh_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti_hash VARCHAR(64) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
    ip_address VARCHAR(45), user_agent TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS contact_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL, company VARCHAR(180) NOT NULL, topic VARCHAR(40) NOT NULL, message TEXT NOT NULL,
    metadata_json JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- V2.3 persisted dashboard builder
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    description TEXT,
    default_time_range VARCHAR(30) NOT NULL DEFAULT '1h',
    refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dashboard_org_slug UNIQUE (organization_id, slug),
    CONSTRAINT ck_dashboard_time_range CHECK (default_time_range IN ('15m','1h','6h','24h','7d','30d')),
    CONSTRAINT ck_dashboard_refresh_interval CHECK (refresh_interval_seconds IN (0,5,10,30,60,300))
);
CREATE INDEX IF NOT EXISTS ix_dashboards_organization_id ON dashboards(organization_id);

CREATE TABLE IF NOT EXISTS dashboard_panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    visualization VARCHAR(30) NOT NULL,
    metric_source VARCHAR(40) NOT NULL,
    metric_name VARCHAR(60) NOT NULL,
    aggregation VARCHAR(20) NOT NULL DEFAULT 'avg',
    unit VARCHAR(30),
    query_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    grid_position JSONB NOT NULL,
    display_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_panel_visualization CHECK (visualization IN ('time_series','stat','gauge','bar','table')),
    CONSTRAINT ck_panel_metric_source CHECK (metric_source IN ('server_metrics','container_metrics','disk_metrics')),
    CONSTRAINT ck_panel_aggregation CHECK (aggregation IN ('avg','min','max','sum','count','p95'))
);
CREATE INDEX IF NOT EXISTS ix_dashboard_panels_dashboard_id ON dashboard_panels(dashboard_id);

-- Servers
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    environment VARCHAR(50) NOT NULL,
    hostname VARCHAR(255),
    ip_address VARCHAR(45) NOT NULL,
    ssh_port INTEGER DEFAULT 22,
    ssh_username VARCHAR(100),
    auth_type VARCHAR(20),
    tags TEXT[],
    description TEXT,
    agent_url VARCHAR(255),
    agent_token_hash VARCHAR(255),
    monitoring_mode VARCHAR(20) DEFAULT 'auto',
    ssh_host_key VARCHAR(255),
    status VARCHAR(20) DEFAULT 'unknown',
    docker_status VARCHAR(50) DEFAULT 'UNKNOWN',
    last_seen TIMESTAMPTZ,
    last_check_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    monitoring_source VARCHAR(20),
    last_cpu_percent NUMERIC,
    last_ram_percent NUMERIC,
    last_disk_percent NUMERIC,
    last_load_1 NUMERIC,
    last_uptime_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
-- Idempotent migrations for any columns added after initial schema
ALTER TABLE servers ADD COLUMN IF NOT EXISTS monitoring_mode VARCHAR(20) DEFAULT 'auto';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_host_key VARCHAR(255);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS docker_status VARCHAR(50) DEFAULT 'UNKNOWN';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_check_at TIMESTAMPTZ;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS monitoring_source VARCHAR(20);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_load_1 NUMERIC;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_uptime_seconds INTEGER;

-- Credential vault
CREATE TABLE IF NOT EXISTS credential_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    auth_type VARCHAR(20),
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Containers
CREATE TABLE IF NOT EXISTS containers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    container_id VARCHAR(64) NOT NULL,
    container_full_id VARCHAR(128),
    name VARCHAR(255) NOT NULL,
    image VARCHAR(512),
    status VARCHAR(50),
    created_at_docker TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    restart_count INTEGER DEFAULT 0,
    exit_code INTEGER,
    oom_killed BOOLEAN DEFAULT FALSE,
    health_status VARCHAR(50),
    network_mode VARCHAR(100),
    ports JSONB,
    volumes JSONB,
    labels JSONB,
    env_vars_masked JSONB,
    last_cpu_percent NUMERIC,
    last_mem_usage BIGINT,
    last_mem_limit BIGINT,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(server_id, container_id)
);

-- Container events
CREATE TABLE IF NOT EXISTS container_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    container_db_id UUID REFERENCES containers(id) ON DELETE SET NULL,
    container_name VARCHAR(255),
    event_type VARCHAR(50),
    exit_code INTEGER,
    oom_killed BOOLEAN DEFAULT FALSE,
    restart_count INTEGER,
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_container_events_occurred ON container_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_container_events_container ON container_events(container_db_id);

-- Server metrics (time-series)
CREATE TABLE IF NOT EXISTS server_metrics (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    cpu_percent NUMERIC,
    load_1 NUMERIC,
    load_5 NUMERIC,
    load_15 NUMERIC,
    cpu_cores INTEGER,
    ram_total BIGINT,
    ram_used BIGINT,
    ram_cached BIGINT,
    ram_available BIGINT,
    swap_total BIGINT,
    swap_used BIGINT,
    net_rx_rate NUMERIC,
    net_tx_rate NUMERIC,
    PRIMARY KEY (id, time)
);
CREATE INDEX IF NOT EXISTS idx_server_metrics_time ON server_metrics(server_id, time DESC);
SELECT create_hypertable(
    'server_metrics',
    'time',
    migrate_data => TRUE,
    if_not_exists => TRUE
);
SELECT add_retention_policy(
    'server_metrics',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- Container metrics (time-series)
CREATE TABLE IF NOT EXISTS container_metrics (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    container_db_id UUID REFERENCES containers(id) ON DELETE CASCADE,
    cpu_percent NUMERIC,
    cpu_normalized NUMERIC,
    mem_usage BIGINT,
    mem_limit BIGINT,
    mem_percent NUMERIC,
    net_rx_rate NUMERIC,
    net_tx_rate NUMERIC,
    block_read_rate NUMERIC,
    block_write_rate NUMERIC,
    pids INTEGER,
    PRIMARY KEY (id, time)
);
CREATE INDEX IF NOT EXISTS idx_container_metrics_time ON container_metrics(container_db_id, time DESC);
SELECT create_hypertable(
    'container_metrics',
    'time',
    migrate_data => TRUE,
    if_not_exists => TRUE
);
SELECT add_retention_policy(
    'container_metrics',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- Disk metrics
CREATE TABLE IF NOT EXISTS disk_metrics (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    mount_point VARCHAR(255),
    filesystem VARCHAR(100),
    total_bytes BIGINT,
    used_bytes BIGINT,
    free_bytes BIGINT,
    use_percent NUMERIC,
    inode_total BIGINT,
    inode_used BIGINT,
    inode_percent NUMERIC,
    PRIMARY KEY (id, time)
);
CREATE INDEX IF NOT EXISTS idx_disk_metrics_time ON disk_metrics(server_id, time DESC);
SELECT create_hypertable(
    'disk_metrics',
    'time',
    migrate_data => TRUE,
    if_not_exists => TRUE
);
SELECT add_retention_policy(
    'disk_metrics',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    target_type VARCHAR(50),
    metric VARCHAR(100),
    operator VARCHAR(10),
    threshold NUMERIC,
    duration_seconds INTEGER DEFAULT 0,
    severity VARCHAR(20) DEFAULT 'warning',
    is_active BOOLEAN DEFAULT TRUE,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_telegram BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    container_db_id UUID REFERENCES containers(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metric_name VARCHAR(100),
    current_value NUMERIC,
    threshold NUMERIC,
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notification_sent BOOLEAN DEFAULT FALSE,
    details JSONB
);
CREATE INDEX IF NOT EXISTS idx_alerts_fired ON alerts(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- CPU spike records
CREATE TABLE IF NOT EXISTS cpu_spikes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    container_db_id UUID REFERENCES containers(id) ON DELETE SET NULL,
    container_name VARCHAR(255),
    spike_from NUMERIC,
    spike_to NUMERIC,
    detected_at TIMESTAMPTZ NOT NULL,
    top_process_pid BIGINT,
    top_process_cmd TEXT,
    top_process_cpu NUMERIC,
    recent_logs TEXT,
    active_crons JSONB,
    investigation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpu_spikes_detected ON cpu_spikes(server_id, detected_at DESC);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
