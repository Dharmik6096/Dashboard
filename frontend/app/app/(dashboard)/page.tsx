"use client";
import { routes } from "@/lib/routes";
import { useEffect, useState, useCallback, useMemo, Suspense, useRef } from "react";
import api from "@/lib/api";
import { formatPercent, formatLastSeen, metricColor } from "@/lib/formatters";
import {
  Server as ServerIcon, AlertTriangle, Cpu, MemoryStick,
  HardDrive, Box, CheckCircle2, Lock, Clock, RefreshCw, XCircle,
  Layers, ChevronDown
} from "lucide-react";
import { TimeSeriesChart, Sparkline } from "@/components/ui/charts";
import { useRouter } from "next/navigation";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { PageTransition } from "@/components/ui/PageTransition";
import { ExpandedChartModal } from "@/components/ui/charts/ExpandedChartModal";
import { GraphPanel } from "@/components/ui/charts/GraphPanel";
import { RankingPanel } from "@/components/ui/RankingPanel";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

interface DashboardData {
  stats: {
    servers: number; servers_online: number;
    containers: number; containers_running: number;
    alerts: number; alerts_critical: number;
    avg_cpu: number; avg_ram: number; avg_disk: number;
  };
  top_consumers: {
    cpu_servers: { id: string; name: string; value: number }[];
    ram_servers: { id: string; name: string; value: number }[];
    cpu_containers: { id: string; name: string; server_name: string; value: number; image?: string; status?: string; created_at?: string }[];
    ram_containers: { id: string; name: string; server_name: string; value: number; image?: string; status?: string; created_at?: string }[];
  };
  recent_alerts: {
    id: string; severity: string; server_name: string; target: string;
    metric: string; alert: string; message: string; status: string;
    current_value: number | null; threshold: number | null;
    created_at: string; resolved_at: string | null;
  }[];
  recent_events: { id: string; time: string; server_name: string; source: string; event: string; severity?: string; event_type?: string }[];
  server_rows: { id: string; name: string; ip_address: string; environment: string; status: string; last_cpu_percent: number | null; last_ram_percent: number | null; last_disk_percent: number | null; load_avg: number | null; container_count: number | null; alert_count: number; uptime: string | null; last_seen: string | null }[];
  filter_servers?: { id: string; name: string }[];
  history: { time: string; cpu?: number; ram?: number; load?: number; rx?: number; tx?: number }[];
  backend_health?: {
    api: { status: string };
    postgres: { status: string; latency_ms?: number };
    redis: { status: string; latency_ms?: number };
    ssh_poller: { status: string; servers_ok: number; servers_fail: number; last_cycle_at?: string | null };
    docker_discovery: { status: string };
    all_ok: boolean;
    overall?: string;
  };
  generated_at?: string;
  meta?: { period: string; bucket_seconds: number; history_points: number };
}

// ---------------------------------------------------------------------------
// Sub‑components
// ---------------------------------------------------------------------------

function MetricCard({
  label, value, sub, maxText, color, icon: Icon, sparklineData, sparklineKey
}: {
  label: string; value: React.ReactNode; sub?: string; maxText?: string; color?: string;
  icon: React.ElementType; sparklineData?: { time: string;[k: string]: number | string }[]; sparklineKey?: string;
}) {
  return (
    <div className="metric-card hover-3d" style={{ '--color-blue': color || 'var(--color-blue)' } as React.CSSProperties}>
      <div className="metric-card-label">
        <Icon size={14} style={{ color: "var(--text-muted)" }} />
        <span>{label}</span>
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        <div className="metric-card-value" style={{ flex: 1 }}>
          {value}
        </div>
        {sparklineData && sparklineKey && (
          <div style={{ height: 32, width: "45%", flexShrink: 0, marginLeft: 8 }}>
            <Sparkline data={sparklineData} dataKey={sparklineKey} color={color || "var(--color-blue)"} />
          </div>
        )}
      </div>

      {(sub || maxText) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%", gap: 8, marginTop: "auto" }}>
          {sub && <span className="metric-card-sub" style={{ color: color || "var(--text-muted)", flex: 1 }}>{sub}</span>}
          {maxText && <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{maxText}</span>}
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title, children, cur, avg, max, onClick
}: { title: string; children: React.ReactNode; cur?: string; avg?: string; max?: string; onClick?: () => void }) {
  return (
    <div
      className="chart-card clickable"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="chart-card-header">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
          {title}
        </span>
        {(cur || avg || max) && (
          <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {cur && <div>CUR <span style={{ color: "var(--color-blue)", fontWeight: 700 }}>{cur}</span></div>}
            {avg && <div>AVG <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{avg}</span></div>}
            {max && <div>MAX <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{max}</span></div>}
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

import { useFilter } from "@/lib/FilterContext";

function OverviewContent() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Realtime clock for "Updated Xs ago" text
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState<"cpu" | "ram" | "load" | "net">("cpu");

  // Alert detail drawer
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DashboardData["recent_alerts"][number] | null>(null);

  // Filters from Global Context
  const { envFilter, setEnvFilter, serverFilter, setServerFilter, servers: masterServers, environments, refreshData } = useFilter();

  // Local state for filter dropdowns in this page toolbar
  const [envDropOpen, setEnvDropOpen] = useState(false);
  const [serverDropOpen, setServerDropOpen] = useState(false);
  const envDropRef = useRef<HTMLDivElement>(null);
  const serverDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (envDropRef.current && !envDropRef.current.contains(e.target as Node)) setEnvDropOpen(false);
      if (serverDropRef.current && !serverDropRef.current.contains(e.target as Node)) setServerDropOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const [period, setPeriod] = useState("1h");
  const [autoRefresh, setAutoRefresh] = useState(10000);

  const [activeFilters, setActiveFilters] = useState({ env: "all", server: "all", period: "1h" });

  const loadData = useCallback(async (isManualRefresh = false) => {
    const currentEnv = envFilter;
    const currentServer = serverFilter;
    const currentPeriod = period;

    if (isManualRefresh) setIsRefreshing(true);
    setRefreshSuccess(false);

    try {
      const res = await api.get(`/overview/dashboard?period=${currentPeriod}&env=${currentEnv}&server_id=${currentServer}&_t=${Date.now()}`);
      const newData = res.data;
      if (!newData.generated_at) {
        newData.generated_at = new Date().toISOString();
      }
      setData(newData);
      setError(null);
      setActiveFilters({ env: currentEnv, server: currentServer, period: currentPeriod });
      refreshData();
      if (isManualRefresh) {
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 1000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, [period, envFilter, serverFilter]);

  useEffect(() => {
    setTimeout(() => {
      setLoading(true);
      loadData();
    }, 0);
  }, [loadData]);

  useEffect(() => {
    if (autoRefresh > 0) {
      const iv = setInterval(() => loadData(false), autoRefresh);
      return () => clearInterval(iv);
    }
  }, [loadData, autoRefresh]);

  // ── derived ─────────────────────────────────────────────────────────────────
  const serversList = useMemo(() => {
    if (envFilter === "all") return masterServers;
    return masterServers.filter(s => (s.environment || "").toLowerCase() === envFilter.toLowerCase());
  }, [masterServers, envFilter]);

  const history = useMemo(() => data?.history ?? [], [data?.history]);

  // Make history for disk flat since it's an avg without history right now
  const historyWithDisk = useMemo(() => {
    if (data?.stats?.avg_disk == null) return [];
    const avg = data.stats.avg_disk;
    return history.map(pt => ({ ...pt, disk: avg }));
  }, [history, data?.stats?.avg_disk]);

  const lastTick = history[history.length - 1];

  // ── early return ────────────────────────────────────────────────────────────
  if (!data) {
    if (loading) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>
          Loading NOC Dashboard…
        </div>
      );
    }
    return (
      <div style={{ padding: 20 }}>
        <div className="alert-banner alert-banner-warning">
          {error || "Failed to load dashboard data. Please check your connection to the backend."}
        </div>
      </div>
    );
  }

  const { stats, top_consumers, recent_alerts, recent_events, backend_health } = data!;

  // ── Scope: drives all label/context logic ────────────────────────────────
  const isSingleServer = activeFilters.server !== "all";
  const selectedServerObj = masterServers.find(s => s.id === activeFilters.server);
  const scope = {
    type: isSingleServer ? "server" : "aggregate",
    serverName: selectedServerObj?.name ?? null,
  };
  // Period-prefixed max label e.g. "1h Max"
  const periodLabel = period === "live" ? "live" : period;

  // Helper: metric card labels
  const cpuLabel = scope.type === "server" ? "CPU Usage" : "Avg CPU";
  const ramLabel = scope.type === "server" ? "RAM Usage" : "Avg RAM";
  const diskLabel = scope.type === "server" ? "Disk Usage" : "Avg Disk";
  const metricSub = scope.type === "server" ? (scope.serverName ?? "") : "Global Avg";
  // Chart title suffix
  const scopeSuffix = scope.type === "server" ? ` — ${scope.serverName}` : " — All Servers";

  // Health strings mapped for rendering
  const healthItems = [
    { label: "API", status: backend_health?.api?.status },
    { label: "PostgreSQL", status: backend_health?.postgres?.status },
    { label: "Redis Cache", status: backend_health?.redis?.status },
    { label: "SSH Poller", status: backend_health?.ssh_poller?.status },
    { label: "Docker Discovery", status: backend_health?.docker_discovery?.status },
  ];

  return (
    <PageTransition style={{ width: "100%", boxSizing: "border-box" }}>
      <div className="overview-content" style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", boxSizing: "border-box" }}>

        {/* ── Toolbar ────────────────────────────────────────────────────────── */}
        <div className="noc-toolbar noc-toolbar-entrance">
          <div className="noc-toolbar-group" style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Overview</div>
          </div>

          <div className="noc-toolbar-divider" />

          {/* ── Environment Dropdown ── */}
          <div ref={envDropRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setEnvDropOpen(o => !o); setServerDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: envFilter !== 'all' ? 'rgba(59,130,246,0.1)' : 'var(--bg-elevated)', border: `1px solid ${envFilter !== 'all' ? 'var(--color-blue)' : 'var(--border)'}`, padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', height: 32, minWidth: 150, transition: 'all 0.15s' }}
            >
              <Layers size={13} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Env:</span>
              <span style={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>{envFilter === 'all' ? 'All' : envFilter}</span>
              <ChevronDown size={12} color="var(--text-muted)" style={{ transform: envDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {envDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 200, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-floating)', zIndex: 200, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeInDown 0.15s ease-out' }}>
                {['all', ...environments].map(env => (
                  <button key={env}
                    onClick={() => { setEnvFilter(env); setEnvDropOpen(false); setServerFilter('all'); }}
                    style={{ textAlign: 'left', padding: '7px 12px', fontSize: 13, borderRadius: 4, background: envFilter === env ? 'var(--bg-active)' : 'transparent', color: envFilter === env ? 'var(--color-blue)' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: envFilter === env ? 600 : 400, transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (envFilter !== env) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (envFilter !== env) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {env === 'all' ? 'All Environments' : env}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Server Dropdown ── */}
          <div ref={serverDropRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setServerDropOpen(o => !o); setEnvDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: serverFilter !== 'all' ? 'rgba(59,130,246,0.1)' : 'var(--bg-elevated)', border: `1px solid ${serverFilter !== 'all' ? 'var(--color-blue)' : 'var(--border)'}`, padding: '4px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', height: 32, minWidth: 160, transition: 'all 0.15s' }}
            >
              <ServerIcon size={13} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Server:</span>
              <span style={{ fontWeight: 600, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {serverFilter === 'all' ? 'All' : (masterServers.find(s => s.id === serverFilter)?.name ?? 'All')}
              </span>
              <ChevronDown size={12} color="var(--text-muted)" style={{ transform: serverDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
            </button>
            {serverDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 220, maxHeight: 280, overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-floating)', zIndex: 200, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeInDown 0.15s ease-out' }}>
                <button
                  onClick={() => { setServerFilter('all'); setServerDropOpen(false); }}
                  style={{ textAlign: 'left', padding: '7px 12px', fontSize: 13, borderRadius: 4, background: serverFilter === 'all' ? 'var(--bg-active)' : 'transparent', color: serverFilter === 'all' ? 'var(--color-blue)' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontWeight: serverFilter === 'all' ? 600 : 400, transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (serverFilter !== 'all') e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (serverFilter !== 'all') e.currentTarget.style.background = 'transparent'; }}
                >
                  All Servers
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                {(envFilter === 'all' ? masterServers : masterServers.filter(s => (s.environment || '').toLowerCase() === envFilter.toLowerCase())).map(s => (
                  <button key={s.id}
                    onClick={() => { setServerFilter(s.id); setServerDropOpen(false); }}
                    style={{ textAlign: 'left', padding: '7px 12px', fontSize: 13, borderRadius: 4, background: serverFilter === s.id ? 'var(--bg-active)' : 'transparent', color: serverFilter === s.id ? 'var(--color-blue)' : 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: serverFilter === s.id ? 600 : 400, transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (serverFilter !== s.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (serverFilter !== s.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.status === 'online' ? 'var(--color-healthy)' : 'var(--color-warning)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="noc-toolbar-divider" />

          <div className="segmented-control" style={{ flexShrink: 0 }}>
            {["live", "5m", "15m", "1h", "6h", "24h", "7d"].map(t => (
              <button
                key={t}
                className={`segmented-btn ${period === t ? "active" : ""} ${period === t ? (t === "live" ? "is-live" : "is-hist") : ""}`}
                onClick={() => setPeriod(t)}
              >
                {t === "live" && <span style={{ fontSize: 10 }}>●</span>}
                {t === "live" ? "LIVE" : t}
              </button>
            ))}
          </div>

          <div className="noc-toolbar-divider" style={{ marginLeft: "auto" }} />

          <div className="noc-toolbar-group" style={{ flexShrink: 0 }}>
            <CustomSelect
              value={autoRefresh}
              onChange={(val) => setAutoRefresh(Number(val))}
              options={[
                { value: 0, label: "Off" },
                { value: 5000, label: "5s" },
                { value: 10000, label: "10s" },
                { value: 20000, label: "20s" },
                { value: 30000, label: "30s" },
                { value: 60000, label: "60s" }
              ]}
              width={85}
            />

            <button className={`btn-refresh ${isRefreshing ? "refreshing" : ""} ${refreshSuccess ? "success" : ""}`} onClick={() => loadData(true)} disabled={isRefreshing} title="Refresh now">
              <RefreshCw size={14} className={isRefreshing ? "spin" : ""} style={{ transition: "transform 0.5s ease" }} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <div style={{
              minWidth: 120,
              textAlign: "right",
              fontSize: 12,
              color: error ? "var(--color-critical)" : ((data?.generated_at && (now - new Date(data.generated_at).getTime()) > 60000) ? "var(--color-warning)" : "var(--text-muted)"),
              fontWeight: 500,
              marginLeft: 12,
              paddingRight: 8,
              whiteSpace: "nowrap"
            }}>
              {(() => {
                if (error) {
                  if (data?.generated_at) {
                    const s = Math.floor((now - new Date(data.generated_at).getTime()) / 1000);
                    return `Refresh failed • Last success ${s > 59 ? Math.floor(s / 60) + 'm' : s + 's'} ago`;
                  }
                  return "Refresh failed";
                }
                if (refreshSuccess) return <span style={{ color: "var(--color-healthy)", transition: "all 0.2s ease" }}>✓ Updated just now</span>;
                if (!data?.generated_at) return "...";
                const s = Math.floor((now - new Date(data.generated_at).getTime()) / 1000);
                if (s < 3) return "Updated just now";
                if (s < 60) return `Updated ${s}s ago`;
                if (s < 3600) return `Updated ${Math.floor(s / 60)}m ago`;
                return `Updated ${Math.floor(s / 3600)}h ago`;
              })()}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {error && <div className="alert-banner alert-banner-warning">{error}</div>}

          {/* ── ROW 1: 6 Metric Cards ───────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
            <MetricCard
              label="Servers" icon={ServerIcon}
              value={<AnimatedNumber value={stats.servers} />}
              sub={`${stats.servers_online} Online`}
              color={(stats.servers_online < stats.servers) ? "var(--color-warning)" : "var(--color-healthy)"}
              sparklineData={history} sparklineKey="cpu"
            />
            <MetricCard
              label="Containers" icon={Box}
              value={<AnimatedNumber value={stats.containers} />}
              sub={`${stats.containers_running} Running`}
              color="var(--color-blue)"
              sparklineData={history} sparklineKey="ram"
            />
            <MetricCard
              label="Active Alerts" icon={AlertTriangle}
              value={<AnimatedNumber value={stats.alerts} />}
              sub={`${stats.alerts_critical} Critical`}
              color={stats.alerts_critical > 0 ? "var(--color-critical)" : stats.alerts > 0 ? "var(--color-warning)" : "var(--color-healthy)"}
              sparklineData={history} sparklineKey="load"
            />
            <MetricCard
              label={cpuLabel} icon={Cpu}
              value={stats.avg_cpu != null ? <><AnimatedNumber value={stats.avg_cpu} format={v => v.toFixed(1)} />%</> : "—"}
              sub={metricSub}
              maxText={history.length > 0 ? `${periodLabel} Max ${Math.max(...history.map(h => h.cpu || 0).concat(stats.avg_cpu != null ? [stats.avg_cpu] : [])).toFixed(1)}%` : (stats.avg_cpu != null ? "Collecting history" : undefined)}
              color={stats.avg_cpu != null ? metricColor(stats.avg_cpu) : "var(--text-muted)"}
              sparklineData={history.length > 0 ? history : undefined} sparklineKey="cpu"
            />
            <MetricCard
              label={ramLabel} icon={MemoryStick}
              value={stats.avg_ram != null ? <><AnimatedNumber value={stats.avg_ram} format={v => v.toFixed(1)} />%</> : "—"}
              sub={metricSub}
              maxText={history.length > 0 ? `${periodLabel} Max ${Math.max(...history.map(h => h.ram || 0).concat(stats.avg_ram != null ? [stats.avg_ram] : [])).toFixed(1)}%` : (stats.avg_ram != null ? "Collecting history" : undefined)}
              color={stats.avg_ram != null ? metricColor(stats.avg_ram) : "var(--text-muted)"}
              sparklineData={history.length > 0 ? history : undefined} sparklineKey="ram"
            />
            <MetricCard
              label={diskLabel} icon={HardDrive}
              value={stats.avg_disk != null ? <><AnimatedNumber value={stats.avg_disk} format={v => v.toFixed(1)} />%</> : "—"}
              sub={metricSub}
              maxText={historyWithDisk.length > 0 ? `${periodLabel} Max ${Math.max(...historyWithDisk.map(h => h.disk).filter((d): d is number => d != null).concat(stats.avg_disk != null ? [stats.avg_disk] : [])).toFixed(1)}%` : (stats.avg_disk != null ? "Collecting history" : undefined)}
              color={stats.avg_disk != null ? metricColor(stats.avg_disk) : "var(--text-muted)"}
              sparklineData={historyWithDisk.length > 0 ? historyWithDisk : undefined} sparklineKey="disk"
            />
          </div>

          {/* ── ROW 2: 4 Main Metric Charts (Click to open Expanded Vis) ─── */}
          <div className="charts-grid">
            <GraphPanel
              title={`CPU Usage${scopeSuffix}`}
              data={history}
              series={[{ key: "cpu", name: "CPU", color: "var(--color-blue)" }]}
              syncId="infra"
              valueSuffix="%"
              onClick={() => { setSelectedGraph("cpu"); setIs3DModalOpen(true); }}
            />

            <GraphPanel
              title={`RAM Usage${scopeSuffix}`}
              data={history}
              series={[{ key: "ram", name: "RAM", color: "var(--color-purple)" }]}
              syncId="infra"
              valueSuffix="%"
              onClick={() => { setSelectedGraph("ram"); setIs3DModalOpen(true); }}
            />

            <GraphPanel
              title={`Load Average (1m)${scopeSuffix}`}
              data={history}
              series={[{ key: "load", name: "Load", color: "var(--color-orange)" }]}
              syncId="infra"
              onClick={() => { setSelectedGraph("load"); setIs3DModalOpen(true); }}
            />

            <GraphPanel
              title={`Network I/O${scopeSuffix}`}
              data={history}
              series={[
                { key: "rx", name: "RX", color: "var(--color-teal)" },
                { key: "tx", name: "TX", color: "var(--color-pink)" }
              ]}
              syncId="infra"
              formatValue={(val) => {
                if (val > 1024) return (val / 1024).toFixed(1) + " MB/s";
                return val.toFixed(1) + " KB/s";
              }}
              onClick={() => { setSelectedGraph("net"); setIs3DModalOpen(true); }}
              yAxisWidth={85}
            />
          </div>

          {/* ── ROW 3: Server Health ─────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Server Health Table */}
            <div className="panel-card">
              <div className="panel-card-header">
                Server Health
              </div>
              <div style={{ overflowX: "auto", padding: "8px 0" }}>
                <table className="data-table" style={{ fontSize: 13, width: "100%", whiteSpace: "nowrap" }}>
                  <thead>
                    <tr>
                      <th>SERVER</th><th>IP ADDRESS</th><th>ENV</th><th>STATUS</th>
                      <th>LOAD (1m)</th><th>CPU</th><th>RAM</th><th>DISK</th>
                      <th>CONTAINERS</th><th>ALERTS</th><th>UPTIME</th><th>LAST UPDATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(serverFilter === "all" ? (data?.server_rows || []) : (data?.server_rows || []).filter(s => s.id === serverFilter)).map(s => (
                      <tr key={s.id} onClick={() => router.push(routes.server(s.id))} className={`clickable ${s.status === "critical" ? "row-alert" : s.status === "warning" ? "row-warn" : ""}`}>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          <div style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>
                            {s.name}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.ip_address || "N/A"}</td>
                        <td style={{ color: "var(--text-muted)" }}>{s.environment === "production" ? "Prod" : s.environment === "staging" ? "Staging" : "Dev"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: s.status === "online" ? "var(--color-healthy)" : s.status === "warning" ? "var(--color-warning)" : s.status === "offline" ? "var(--text-muted)" : "var(--color-critical)", fontWeight: 600, fontSize: 12 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", boxShadow: `0 0 8px currentColor` }} />
                            {s.status === "online" ? "HEALTHY" : s.status.toUpperCase()}
                          </div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>{s.load_avg != null ? s.load_avg.toFixed(2) : "N/A"}</td>
                        <td>
                          {s.last_cpu_percent != null ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 70 }}>
                              <span style={{ color: metricColor(s.last_cpu_percent), fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.last_cpu_percent.toFixed(1)}%</span>
                              <div style={{ height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(s.last_cpu_percent, 100)}%`, background: metricColor(s.last_cpu_percent), borderRadius: 2 }} /></div>
                            </div>
                          ) : "N/A"}
                        </td>
                        <td>
                          {s.last_ram_percent != null ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 70 }}>
                              <span style={{ color: metricColor(s.last_ram_percent), fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.last_ram_percent.toFixed(0)}%</span>
                              <div style={{ height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(s.last_ram_percent, 100)}%`, background: metricColor(s.last_ram_percent), borderRadius: 2 }} /></div>
                            </div>
                          ) : "N/A"}
                        </td>
                        <td>
                          {s.last_disk_percent != null && s.last_disk_percent > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 70 }}>
                              <span style={{ color: metricColor(s.last_disk_percent), fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.last_disk_percent.toFixed(0)}%</span>
                              <div style={{ height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(s.last_disk_percent, 100)}%`, background: metricColor(s.last_disk_percent), borderRadius: 2 }} /></div>
                            </div>
                          ) : "N/A"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>
                          {s.container_count === null ? "PERMISSION" : s.container_count}
                        </td>
                        <td style={{ color: s.alert_count > 0 ? "var(--color-critical)" : "var(--text-muted)", fontWeight: s.alert_count > 0 ? 700 : 400, fontFamily: "var(--font-mono)" }}>{s.alert_count}</td>
                        <td style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{s.uptime || "N/A"}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                          {(s as any).is_stale ? <span style={{ color: "var(--color-critical)", fontWeight: 600 }}>STALE • </span> : ""}
                          {s.last_seen ? formatLastSeen(s.last_seen) : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── ROW 4: Top Consumers ─────────────────────── */}
          <div className="ranking-grid">
            <RankingPanel
              title="Top CPU Servers"
              context="Current"
              color="var(--color-blue)"
              scaleMode="percent"
              items={(serverFilter === "all" ? (data?.top_consumers?.cpu_servers || []) : (data?.top_consumers?.cpu_servers || []).filter(s => s.id === serverFilter)).map(s => ({
                id: s.id, name: s.name, value: s.value, label: `${s.value.toFixed(1)}%`,
                tooltipData: { "CPU": `${s.value.toFixed(1)}%` }
              }))}
              onClick={(item) => router.push(routes.server(item.id))}
            />
            <RankingPanel
              title="Top RAM Servers"
              context="Current"
              color="var(--color-purple)"
              scaleMode="percent"
              items={(serverFilter === "all" ? (data?.top_consumers?.ram_servers || []) : (data?.top_consumers?.ram_servers || []).filter(s => s.id === serverFilter)).map(s => ({
                id: s.id, name: s.name, value: s.value, label: `${s.value.toFixed(0)}%`,
                tooltipData: { "RAM": `${s.value.toFixed(0)}%` }
              }))}
              onClick={(item) => router.push(routes.server(item.id))}
            />
            <RankingPanel
              title="Top CPU Containers"
              context="Current"
              color="var(--color-teal)"
              scaleMode="relative"
              items={(serverFilter === "all" ? (data?.top_consumers?.cpu_containers || []) : (data?.top_consumers?.cpu_containers || []).filter(c => c.server_name === (data?.server_rows || []).find(s => s.id === serverFilter)?.name)).map(c => ({
                id: c.id, name: c.name, value: c.value, label: `${c.value.toFixed(1)}%`,
                tooltipData: { "Server": c.server_name, "CPU": `${c.value.toFixed(1)}%`, "Status": c.status || "Unknown" }
              }))}
            />
            <RankingPanel
              title="Top RAM Containers (%)"
              context="Current"
              color="var(--color-pink)"
              scaleMode="relative"
              items={(serverFilter === "all" ? (data?.top_consumers?.ram_containers || []) : (data?.top_consumers?.ram_containers || []).filter(c => c.server_name === (data?.server_rows || []).find(s => s.id === serverFilter)?.name)).map(c => ({
                id: c.id, name: c.name, value: c.value, label: `${c.value.toFixed(1)}%`,
                tooltipData: { "Server": c.server_name, "RAM": `${c.value.toFixed(1)}%`, "Status": c.status || "Unknown" }
              }))}
            />
          </div>

          {/* ── ROW 5: Recent Alerts | Recent Events ──────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>

            {/* Recent Alerts */}
            <div className="panel-card">
              <div className="panel-card-header">
                Recent Alerts
                <span onClick={() => router.push(routes.alerts)} style={{ fontSize: 11, color: "var(--color-blue)", cursor: "pointer", fontWeight: 600 }}>View all alerts →</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", display: "flex", flexDirection: "column", maxHeight: 260 }}>
                {(!recent_alerts || recent_alerts.length === 0) && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 24, fontSize: 13 }}>No alerts in the selected time range</div>
                )}
                {recent_alerts?.slice(0, 5).map(a => {
                  const isResolved = a.status === "resolved";
                  return (
                    <div key={a.id} onClick={() => { setSelectedAlert(a); setAlertDrawerOpen(true); }} className="clickable hover-bg-input"
                      style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)", opacity: isResolved ? 0.6 : 1 }}>
                      <span className="badge" style={{ fontSize: 10, minWidth: 60, textAlign: "center", background: a.severity === "critical" ? "var(--color-critical)" : "var(--color-warning)", color: "#000", fontWeight: 800 }}>
                        {a.severity.toUpperCase()}
                      </span>
                      <span className="badge" style={{ fontSize: 10, minWidth: 65, textAlign: "center", background: isResolved ? "var(--color-healthy)" : "var(--bg-input)", color: isResolved ? "#000" : "var(--text-primary)", border: isResolved ? "none" : "1px solid var(--border-subtle)", fontWeight: 700 }}>
                        {isResolved ? "RESOLVED" : "ACTIVE"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{a.target}</span>
                        <span style={{ fontSize: 13, color: isResolved ? "var(--text-muted)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.message || a.alert}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{formatLastSeen(a.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Events */}
            <div className="panel-card">
              <div className="panel-card-header">
                Latest Events
                <span onClick={() => router.push(routes.events)} style={{ fontSize: 11, color: "var(--color-blue)", cursor: "pointer", fontWeight: 600 }}>View all events →</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", display: "flex", flexDirection: "column", maxHeight: 260 }}>
                {(!recent_events || recent_events.length === 0) && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, marginTop: 24 }}>No events in the selected time range</div>
                )}
                {recent_events?.slice(0, 5).map(e => (
                  <div key={e.id} onClick={() => router.push(routes.events)} className="clickable hover-bg-input" style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.severity === "error" ? "var(--color-critical)" : e.severity === "warning" ? "var(--color-warning)" : "var(--color-blue)", flexShrink: 0, position: "relative" }}>
                      <div style={{ position: "absolute", top: 12, left: 3, width: 2, height: 20, background: "var(--border-subtle)" }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{e.server_name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatLastSeen(e.time)}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 500, marginRight: 6 }}>[{e.source.toUpperCase()}]</span>
                        {e.event}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer Status Bar ─────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0, height: 32, borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-panel)", display: "flex", alignItems: "center",
          padding: "0 16px", fontSize: 11, color: "var(--text-muted)",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            {healthItems.map(item => {
              let color = "var(--text-muted)";
              if (item.status === "HEALTHY") color = "var(--color-healthy)";
              else if (item.status === "DEGRADED" || item.status === "STALE" || item.status === "LIMITED") color = "var(--color-warning)";
              else if (item.status === "DOWN" || item.status === "ERROR") color = "var(--color-critical)";

              return (
                <span key={item.label} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "help" }} title={item.status}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  {item.label}
                </span>
              );
            })}
            <span style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 12, borderLeft: "1px solid var(--border-subtle)" }}>
              <Lock size={12} /> Read-Only Mode
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {backend_health?.overall === "Platform Healthy" ? (
              <span style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color-healthy)", fontWeight: 500 }}>
                <CheckCircle2 size={12} /> {backend_health.overall}
              </span>
            ) : backend_health?.overall === "Monitoring Degraded" ? (
              <span style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color-warning)", fontWeight: 500 }}>
                <AlertTriangle size={12} /> {backend_health.overall}
              </span>
            ) : (
              <span style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color-critical)", fontWeight: 500 }}>
                <XCircle size={12} /> {backend_health?.overall || "Status Unknown"}
              </span>
            )}
            <span>Updated {data?.generated_at ? formatLastSeen(data.generated_at) : "…"}</span>
          </div>
        </div>

        {/* ── Expanded Diagnostics Modal ────────────────────────────────────── */}
        <ExpandedChartModal
          isOpen={is3DModalOpen}
          onClose={() => setIs3DModalOpen(false)}
          title={
            selectedGraph === "cpu" ? "CPU Usage" :
              selectedGraph === "ram" ? "RAM Usage" :
                selectedGraph === "load" ? "Load Average (1m)" : "Network I/O"
          }
          metricKey={selectedGraph === "net" ? "rx,tx" : selectedGraph}
          metricName={
            selectedGraph === "cpu" ? "CPU" :
              selectedGraph === "ram" ? "RAM" :
                selectedGraph === "load" ? "Load" : "Network"
          }
          color={
            selectedGraph === "cpu" ? "var(--color-blue)" :
              selectedGraph === "ram" ? "var(--color-purple)" :
                selectedGraph === "load" ? "var(--color-orange)" : "var(--color-teal)"
          }
          serverId={serverFilter}
          envFilter={envFilter}
          valueSuffix={selectedGraph === "cpu" || selectedGraph === "ram" ? "%" : ""}
          formatValue={selectedGraph === "net" ? (val) => {
            if (1024 < val) return (val / 1024).toFixed(1) + " MB/s";
            return val.toFixed(1) + " KB/s";
          } : undefined}
          alerts={data?.recent_alerts}
          events={data?.recent_events}
        />

        {/* ── Alert Detail Drawer ──────────────────────────────────────────── */}
        {alertDrawerOpen && selectedAlert && (
          <div
            id="alert-detail-drawer"
            onClick={e => { if ((e.target as HTMLElement).id === "alert-detail-drawer") setAlertDrawerOpen(false); }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
              zIndex: 900, display: "flex", justifyContent: "flex-end",
              backdropFilter: "blur(3px)",
              animation: "fadeIn 0.15s ease",
            }}
          >
            <div style={{
              width: "min(460px, 92vw)", height: "100%", background: "var(--bg-panel)",
              borderLeft: "1px solid var(--border-subtle)", display: "flex",
              flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
              animation: "slideInRight 0.2s ease",
            }}>
              {/* Header */}
              <div style={{
                padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--bg-elevated)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                      background: selectedAlert.severity === "critical" ? "var(--color-critical)" : "var(--color-warning)",
                      color: "#fff",
                    }}
                  >
                    {selectedAlert.severity.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Alert Detail</span>
                </div>
                <button
                  onClick={() => setAlertDrawerOpen(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {/* Status + target row */}
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 4,
                    background: selectedAlert.status === "resolved" ? "var(--color-healthy)" : "var(--bg-input)",
                    color: selectedAlert.status === "resolved" ? "#fff" : "var(--text-primary)",
                    border: selectedAlert.status === "resolved" ? "none" : "1px solid var(--border-subtle)",
                  }}>{selectedAlert.status.toUpperCase()}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>Target: <span style={{ marginLeft: 4, fontWeight: 600, color: "var(--text-primary)" }}>{selectedAlert.target}</span></span>
                </div>

                {/* Fields grid */}
                {([
                  ["Alert", selectedAlert.alert],
                  ["Message", selectedAlert.message || "—"],
                  ["Metric", selectedAlert.metric],
                  ["Current Value", selectedAlert.current_value != null ? `${Number(selectedAlert.current_value).toFixed(1)}%` : "—"],
                  ["Threshold", selectedAlert.threshold != null ? `${selectedAlert.threshold}%` : "—"],
                  ["Fired At", selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString() : "—"],
                  ["Resolved At", selectedAlert.resolved_at ? new Date(selectedAlert.resolved_at).toLocaleString() : selectedAlert.status === "resolved" ? "—" : "Still active"],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: label === "Message" ? 400 : 500 }}>{val}</div>
                  </div>
                ))}

                {/* Divider */}
                <div style={{ height: 1, background: "var(--border-subtle)", margin: "20px 0" }} />

                {/* Threshold indicator */}
                {selectedAlert.current_value != null && selectedAlert.threshold != null && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Value vs Threshold</div>
                    <div style={{ background: "var(--bg-input)", borderRadius: 6, overflow: "hidden", height: 8, position: "relative" }}>
                      {/* Threshold line */}
                      <div style={{
                        position: "absolute", top: 0, bottom: 0, left: 0,
                        width: `${Math.min(100, selectedAlert.threshold)}%`,
                        background: "rgba(255,200,0,0.18)",
                        borderRight: "2px dashed var(--color-warning)",
                      }} />
                      {/* Current value bar */}
                      <div style={{
                        position: "absolute", top: 0, bottom: 0, left: 0,
                        width: `${Math.min(100, selectedAlert.current_value)}%`,
                        background: selectedAlert.severity === "critical" ? "var(--color-critical)" : "var(--color-warning)",
                        opacity: 0.85, borderRadius: 6,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      <span>Current: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{Number(selectedAlert.current_value).toFixed(1)}%</span></span>
                      <span>Threshold: <span style={{ color: "var(--color-warning)", fontWeight: 600 }}>{selectedAlert.threshold}%</span></span>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => router.push(routes.alerts)}
                    style={{
                      flex: 1, padding: "9px 14px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    }}
                  >
                    View All Alerts →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// ---------------------------------------------------------------------------
export default function OverviewDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading NOC Dashboard…</div>}>
      <OverviewContent />
    </Suspense>
  );
}
