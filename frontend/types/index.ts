// types/index.ts — shared TypeScript types

export type ServerStatus = "online" | "warning" | "critical" | "offline" | "unknown";

export interface Server {
  id: string;
  name: string;
  environment?: string;
  ip_address: string;
  hostname?: string;
  ssh_port: number;
  ssh_username?: string;
  auth_type?: string;
  agent_url?: string;
  monitoring_mode?: "auto" | "agent" | "ssh";
  tags?: string[];
  description?: string;
  status: ServerStatus;
  last_seen: string | null;
  last_check_at?: string | null;
  last_success_at?: string | null;
  monitoring_source?: string | null;
  last_cpu_percent: number | null;
  last_ram_percent: number | null;
  last_disk_percent: number | null;
  last_load1?: number | null;
  load_avg?: number | null;
  container_count?: number;
  active_alerts_count?: number;
  alert_count?: number;
  uptime_seconds?: number;
  docker_status?: string;
  os_version?: string;
  created_at: string;
}

export type ContainerStatus = "running" | "exited" | "stopped" | "unhealthy" | "paused" | "restarting" | "dead" | "created" | "unknown";

export interface Container {
  id: string;
  server_id: string;
  server_name?: string;
  container_id: string;
  name: string;
  image?: string;
  status: ContainerStatus;
  restart_count: number;
  exit_code?: number;
  oom_killed: boolean;
  health_status?: string;
  network_mode?: string;
  ports?: Record<string, string>;
  volumes?: string[];
  labels?: Record<string, string>;
  env_vars?: Record<string, string>;
  last_cpu_percent?: number;
  last_mem_usage?: number;
  last_mem_limit?: number;
  last_seen?: string;
  created_at: string;
}

export interface ServerMetricPoint {
  time: string;
  cpu_percent?: number;
  load_1?: number;
  load_5?: number;
  load_15?: number;
  ram_used?: number;
  ram_total?: number;
  net_rx_rate?: number;
  net_tx_rate?: number;
}

export interface ContainerMetricPoint {
  time: string;
  cpu_percent?: number;
  cpu_normalized?: number;
  mem_usage?: number;
  mem_limit?: number;
  mem_percent?: number;
  net_rx_rate?: number;
  net_tx_rate?: number;
  block_read_rate?: number;
  block_write_rate?: number;
  pids?: number;
}

export interface DiskPartition {
  mount_point: string;
  filesystem?: string;
  device?: string;
  total: number;
  used: number;
  free: number;
  use_percent: number;
  inode_total?: number;
  inode_used?: number;
  inode_percent?: number;
}

export interface ContainerProcess {
  pid: number;
  ppid?: number;
  user?: string;
  cpu_percent: number;
  mem_percent?: number;
  elapsed?: string;
  command: string;
}

export interface ContainerEvent {
  id: string;
  event_type: string;
  exit_code?: number;
  oom_killed: boolean;
  restart_count?: number;
  reason?: string;
  occurred_at: string;
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric_name?: string;
  current_value?: number;
  threshold?: number;
  status: AlertStatus;
  server_id?: string;
  server_name?: string;
  container_id?: string;
  container_name?: string;
  alert_name?: string;
  condition_started_at?: string;
  fired_at?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  target_type: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: AlertSeverity;
  is_active: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  created_at: string;
}

export interface ListeningPort {
  port: number;
  protocol: string;
  process?: string;
  pid?: number;
  address?: string;
}

export interface CronJob {
  schedule: string;
  command: string;
  user?: string;
  source?: string;
  is_running: boolean;
  running_pid?: number;
}

export interface NginxStatus {
  service_running: boolean;
  config_valid: boolean;
  config_errors?: string[];
  master_pid?: number;
  worker_count?: number;
  error_log_tail?: string[];
  error_log_path?: string;
  access_log_path?: string;
}

export interface NetworkInterface {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_rate: number;
  tx_rate: number;
  rx_errors?: number;
  tx_errors?: number;
}

export interface SearchResult {
  type: "server" | "container";
  id: string;
  name: string;
  subtitle?: string;
  status?: string;
  environment?: string;
  server_id?: string;
  cpu_percent?: number;
  mem_usage?: number;
  url: string;
}
