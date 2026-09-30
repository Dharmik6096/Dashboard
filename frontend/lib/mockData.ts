export const mockDashboardData = {
  stats: {
    servers: 128, servers_online: 126,
    containers: 842, containers_running: 830,
    alerts: 15, alerts_critical: 3,
    avg_cpu: 42.5, avg_ram: 68.2, avg_disk: 55.4,
  },
  top_consumers: {
    cpu_servers: [
      { id: "s1", name: "api-gateway-01", value: 92.4 },
      { id: "s2", name: "worker-batch-04", value: 88.1 },
      { id: "s3", name: "db-primary-us", value: 75.3 },
    ],
    ram_servers: [
      { id: "s3", name: "db-primary-us", value: 94.2 },
      { id: "s4", name: "cache-redis-01", value: 89.5 },
      { id: "s5", name: "search-node-02", value: 82.1 },
    ],
    cpu_containers: [
      { id: "c1", name: "payment-processor-1", server_name: "worker-batch-04", value: 124.5, image: "payment-svc:v2.4", status: "running" },
      { id: "c2", name: "image-resizer-3", server_name: "worker-media-01", value: 98.2, image: "media-worker:v1.2", status: "running" },
      { id: "c3", name: "auth-service-2", server_name: "api-gateway-01", value: 85.1, image: "auth-svc:v3.1", status: "running" },
    ],
    ram_containers: [
      { id: "c4", name: "ml-inference-engine", server_name: "gpu-node-01", value: 4096.5, image: "ml-engine:v5.0", status: "running" },
      { id: "c5", name: "log-aggregator", server_name: "infra-node-02", value: 2048.1, image: "fluentd:v1.14", status: "running" },
      { id: "c6", name: "in-memory-cache", server_name: "cache-redis-01", value: 1850.3, image: "redis:7.0", status: "running" },
    ],
  },
  recent_alerts: [
    {
      id: "a1", severity: "critical", server_name: "api-gateway-01", target: "CPU",
      metric: "cpu_usage", alert: "CPU \u003e 90%", message: "CPU usage sustained above 90% for 5 minutes", status: "active",
      current_value: 92.4, threshold: 90, created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), resolved_at: null,
    },
    {
      id: "a2", severity: "warning", server_name: "db-primary-us", target: "RAM",
      metric: "ram_usage", alert: "RAM \u003e 85%", message: "Memory usage approaching critical levels", status: "active",
      current_value: 86.2, threshold: 85, created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), resolved_at: null,
    },
    {
      id: "a3", severity: "critical", server_name: "worker-batch-04", target: "Disk",
      metric: "disk_usage", alert: "Disk \u003e 95%", message: "Root partition almost full", status: "active",
      current_value: 96.1, threshold: 95, created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), resolved_at: null,
    },
  ],
  recent_events: [
    { id: "e1", time: new Date(Date.now() - 1000 * 60 * 5).toISOString(), server_name: "api-gateway-01", source: "docker", event: "Container payment-processor-1 started", severity: "info", event_type: "container_start" },
    { id: "e2", time: new Date(Date.now() - 1000 * 60 * 12).toISOString(), server_name: "db-primary-us", source: "system", event: "PostgreSQL service restarted", severity: "warning", event_type: "service_restart" },
    { id: "e3", time: new Date(Date.now() - 1000 * 60 * 25).toISOString(), server_name: "worker-batch-04", source: "system", event: "High CPU load detected", severity: "warning", event_type: "high_load" },
    { id: "e4", time: new Date(Date.now() - 1000 * 60 * 40).toISOString(), server_name: "infra-node-02", source: "agent", event: "Agent connected", severity: "info", event_type: "agent_connect" },
    { id: "e5", time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), server_name: "cache-redis-01", source: "docker", event: "Container in-memory-cache updated", severity: "info", event_type: "container_update" },
  ],
  server_rows: [
    { id: "s1", name: "api-gateway-01", ip_address: "10.0.1.15", environment: "production", status: "online", last_cpu_percent: 92.4, last_ram_percent: 64.2, last_disk_percent: 45.1, load_avg: 4.2, container_count: 12, alert_count: 1, uptime: "45d 12h", last_seen: new Date().toISOString() },
    { id: "s2", name: "worker-batch-04", ip_address: "10.0.1.22", environment: "production", status: "online", last_cpu_percent: 88.1, last_ram_percent: 72.5, last_disk_percent: 96.1, load_avg: 3.8, container_count: 8, alert_count: 1, uptime: "12d 4h", last_seen: new Date().toISOString() },
    { id: "s3", name: "db-primary-us", ip_address: "10.0.2.10", environment: "production", status: "online", last_cpu_percent: 75.3, last_ram_percent: 94.2, last_disk_percent: 65.8, load_avg: 2.1, container_count: 4, alert_count: 1, uptime: "120d 8h", last_seen: new Date().toISOString() },
    { id: "s4", name: "cache-redis-01", ip_address: "10.0.2.15", environment: "production", status: "online", last_cpu_percent: 25.4, last_ram_percent: 89.5, last_disk_percent: 15.2, load_avg: 0.5, container_count: 2, alert_count: 0, uptime: "60d 2h", last_seen: new Date().toISOString() },
    { id: "s5", name: "search-node-02", ip_address: "10.0.3.5", environment: "production", status: "online", last_cpu_percent: 45.2, last_ram_percent: 82.1, last_disk_percent: 35.4, load_avg: 1.2, container_count: 6, alert_count: 0, uptime: "30d 14h", last_seen: new Date().toISOString() },
    { id: "s6", name: "staging-web-01", ip_address: "10.1.1.10", environment: "staging", status: "online", last_cpu_percent: 15.2, last_ram_percent: 45.8, last_disk_percent: 25.1, load_avg: 0.2, container_count: 8, alert_count: 0, uptime: "5d 6h", last_seen: new Date().toISOString() },
    { id: "s7", name: "dev-db-01", ip_address: "10.2.1.5", environment: "development", status: "offline", last_cpu_percent: null, last_ram_percent: null, last_disk_percent: null, load_avg: null, container_count: null, alert_count: 0, uptime: null, last_seen: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  ],
  history: Array.from({ length: 60 }).map((_, i) => ({
    time: new Date(Date.now() - (59 - i) * 60000).toISOString(),
    cpu: 35 + Math.random() * 20 + (i > 45 ? 15 : 0),
    ram: 60 + Math.random() * 10 + (i * 0.2),
    load: 1.5 + Math.random() * 1.0 + (i > 45 ? 1.0 : 0),
    rx: 50 + Math.random() * 100,
    tx: 30 + Math.random() * 80,
  })),
  backend_health: {
    api: { status: "healthy" },
    postgres: { status: "healthy", latency_ms: 5.2 },
    redis: { status: "healthy", latency_ms: 1.5 },
    ssh_poller: { status: "healthy", servers_ok: 126, servers_fail: 2, last_cycle_at: new Date().toISOString() },
    docker_discovery: { status: "healthy" },
    all_ok: true,
    overall: "healthy",
  },
  generated_at: new Date().toISOString(),
  meta: { period: "1h", bucket_seconds: 60, history_points: 60 },
};
