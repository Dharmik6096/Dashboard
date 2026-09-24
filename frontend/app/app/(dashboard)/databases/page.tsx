"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, Search, Database,
  ChevronRight, ChevronDown,
  Activity, Info, AlertCircle, PlayCircle, ShieldCheck,
  LayoutGrid, Cpu, MemoryStick, HardDrive, Clock, RotateCcw
} from "lucide-react";
import { api } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DbInstance {
  id: string;
  server_id: string;
  server_name: string;
  server_env: string;
  container_id: string;
  container_name: string;
  engine: string;
  engine_version: string;
  database_name: string;
  image: string;
  status: "Healthy" | "Warning" | "Critical" | "Stale";
  cpu_percent: number;
  memory_percent: number;
  memory_usage: number;
  memory_limit: number;
  storage_bytes: number;
  connections: number | null;
  max_connections: number | null;
  qps: number | null;
  response_time_ms: number | null;
  replication_role: string;
  published_ports: string;
  docker_network: string;
  volume_mounts: string;
  uptime_seconds: number;
  last_seen: string | null;
  restart_count: number;
  oom_killed: boolean;
}

interface DbData {
  items: DbInstance[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  healthy: number;
  warning: number;
  critical: number;
  stale: number;
  avg_cpu: number;
  avg_ram: number;
  engines: Record<string, number>;
  top_cpu: DbInstance[];
  environments: string[];
  collected_at?: string;
}

interface DetailData extends DbInstance {
  sparkline: { time: string; cpu: number; mem: number }[];
  recent_alerts: { severity: string; message: string; status: string; fired_at: string | null }[];
  engine_telemetry_available: boolean;
  data_source: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ENGINE_ICONS: Record<string, string> = {
  PostgreSQL: "🐘", MySQL: "🐬", MariaDB: "🐬", MongoDB: "🍃",
  "SQL Server": "🪟", Oracle: "🔴", Cassandra: "👁", CockroachDB: "🪳", TiDB: "💧",
  Redis: "⚡", RabbitMQ: "🐇", Memcached: "🗂️", Kafka: "📨",
  etcd: "🔑", Unknown: "📦",
};

const ENGINE_COLORS: Record<string, string> = {
  PostgreSQL: "var(--color-blue)", MySQL: "var(--color-orange)", MariaDB: "var(--color-orange)",
  MongoDB: "var(--color-healthy)", "SQL Server": "var(--color-red)", Oracle: "var(--color-red)",
  Cassandra: "var(--color-cyan)", CockroachDB: "var(--color-purple)", TiDB: "var(--color-blue)",
  Unknown: "var(--text-muted)",
};

const ALL_ENGINES  = ["PostgreSQL", "MySQL", "MariaDB", "MongoDB", "SQL Server", "Oracle", "Cassandra", "CockroachDB", "TiDB"];
const REFRESH_MS   = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtBytes = (b: number) => {
  if (!b) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(b)/Math.log(k));
  return `${(b/Math.pow(k,i)).toFixed(1)} ${s[i]}`;
};
const fmtUptime = (s: number) => {
  if (!s) return "—";
  const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60);
  if(d>0) return `${d}d ${h}h`;
  if(h>0) return `${h}h ${m}m`;
  return `${m}m`;
};
const fmtRel = (iso: string|null) => {
  if(!iso) return "—";
  const diff=(Date.now()-new Date(iso).getTime())/1000;
  if(diff<60) return "Just now";
  if(diff<3600) return `${Math.floor(diff/60)}m ago`;
  if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});


// ─────────────────────────────────────────────────────────────────────────────
// Expanded Detail Component
// ─────────────────────────────────────────────────────────────────────────────
function ExpandedDetail({ item }: { item: DbInstance }) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "queries" | "logs" | "config">("overview");

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    api.get(`/databases/${item.id}`)
      .then(r => setDetail(r.data as DetailData))
      .catch(() => setDetail({ ...item, sparkline: [], recent_alerts: [], engine_telemetry_available: false, data_source: "docker_stats" }))
      .finally(() => setLoading(false));
  }, [item]);

  const d = detail ?? item;
  const sparkline = detail?.sparkline ?? [];
  const alerts = detail?.recent_alerts ?? [];
  const engColor = ENGINE_COLORS[d.engine] || "var(--text-muted)";

  const tabStyle = (tabId: string) => ({
    padding: '8px 16px',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: activeTab === tabId ? 'var(--color-blue)' : 'var(--text-muted)',
    borderBottom: activeTab === tabId ? '2px solid var(--color-blue)' : '2px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    outline: 'none',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ padding: '0' }}>
      {/* Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', padding: '0 24px' }}>
        <button style={tabStyle("overview")} onClick={() => setActiveTab("overview")}>Overview</button>
        <button style={tabStyle("queries")} onClick={() => setActiveTab("queries")}>Slow Queries</button>
        <button style={tabStyle("logs")} onClick={() => setActiveTab("logs")}>Live Logs</button>
        <button style={tabStyle("config")} onClick={() => setActiveTab("config")}>Configuration</button>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {activeTab === "overview" && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {/* Left Column - Live Metrics & Sparkline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: `var(--bg-card-hover)`, border: `1px solid var(--border-subtle)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {ENGINE_ICONS[d.engine] || "📦"}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--text-primary)', fontWeight: 600 }}>{d.database_name}</h3>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: engColor }}>{d.engine} {d.engine_version}</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border)' }} />
                    <span>{d.server_name}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon:<Cpu size={14}/>, label:"CPU Usage", value:`${(d.cpu_percent||0).toFixed(2)}%`, color: d.cpu_percent>80?"var(--color-red)":"var(--color-blue)" },
                  { icon:<MemoryStick size={14}/>, label:"Memory", value:`${(d.memory_percent||0).toFixed(1)}%`, color: d.memory_percent>80?"var(--color-red)":"var(--color-purple)" },
                  { icon:<HardDrive size={14}/>, label:"Mem Used", value:fmtBytes(d.memory_usage), color:"var(--text-primary)" },
                  { icon:<RotateCcw size={14}/>, label:"Restarts", value:String(d.restart_count), color: d.restart_count>0?"var(--color-warning)":"var(--text-primary)" },
                ].map((stat, i) => (
                  <div key={i} style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span style={{ color: stat.color }}>{stat.icon}</span>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                      {loading ? <span style={{ opacity: 0.5 }}>--</span> : stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Performance History</div>
                <div style={{ height: 120 }}>
                  {loading ? (
                     <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading metrics...</div>
                  ) : sparkline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkline} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtTime} minTickGap={25} />
                        <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
                        <Tooltip contentStyle={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:6, fontSize:12 }} itemStyle={{ color:"var(--text-primary)" }} labelFormatter={(label) => fmtTime(String(label ?? ""))} />
                        <Line type="monotone" dataKey="cpu" name="CPU %" stroke="var(--color-blue)" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="mem" name="Mem %" stroke="var(--color-purple)" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:8 }}>
                      <Activity size={24} color="var(--text-muted)" />
                      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>No historical telemetry available</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                 <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Container Details</div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                   {[
                     { label:"Container ID", value:d.container_id?.slice(0,12), mono:true },
                     { label:"Image", value:d.image, mono:true },
                     { label:"Environment", value:d.server_env },
                     { label:"Network", value:d.docker_network, mono:true },
                     { label:"Ports", value:d.published_ports, mono:true },
                     { label:"Replication", value:d.replication_role },
                     { label:"OOM Killed", value:d.oom_killed?"⚠ Yes":"No" },
                     { label:"Uptime", value:fmtUptime(d.uptime_seconds) },
                     { label:"Last Seen", value:fmtRel(d.last_seen) },
                   ].map((row, i) => (
                     <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 8, borderBottom: i===8 ? 'none' : '1px solid var(--border-subtle)' }}>
                       <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{row.label}</span>
                       <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', fontFamily: row.mono ? 'var(--font-mono)' : 'inherit', textAlign: 'right', wordBreak: 'break-all', maxWidth: 200 }}>
                         {row.value || "—"}
                       </span>
                     </div>
                   ))}
                 </div>
              </div>

              {!detail?.engine_telemetry_available && (
                 <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12 }}>
                   <Info size={16} color="var(--color-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                     <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-blue)' }}>Engine Telemetry Missing</span>
                     <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                       Deep metrics like queries per second, cache hit ratio, and active connections require the specific {d.engine} engine collector to be enabled. Current data is from Docker container stats.
                     </span>
                   </div>
                 </div>
              )}

              {alerts.length > 0 && (
                 <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Recent Events</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {alerts.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                           <span style={{ 
                             fontSize: 'var(--font-xs)', padding: '2px 6px', borderRadius: 'var(--radius-full)', 
                             background: a.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', 
                             color: a.severity === 'critical' ? 'var(--color-red)' : 'var(--color-warning)', 
                             fontWeight: 600, textTransform: 'uppercase', alignSelf: 'flex-start' 
                           }}>
                             {a.severity}
                           </span>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                             <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>{a.message}</span>
                             <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{fmtRel(a.fired_at)}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}
            </div>
          </div>
        )}

        {/* Slow Queries Tab */}
        {activeTab === "queries" && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <Activity size={48} color="var(--border)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 'var(--font-lg)', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Slow Query Telemetry</h3>
            <p style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Tracking query execution plans and long-running transactions requires the specific {d.engine} engine collector to be enabled.
            </p>
            <span className="roadmap-badge">Engine collector · Roadmap</span>
          </div>
        )}

        {/* Live Logs Tab */}
        {activeTab === "logs" && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 400, background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--bg-elevated)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{d.container_name} logs</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                Roadmap
              </span>
            </div>
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               <AlertCircle size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
               <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-mono)' }}>Database log streaming is not implemented yet.</p>
               <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', fontFamily: 'var(--font-mono)' }}>[Roadmap: read-only engine collector]</p>
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 'var(--font-lg)', color: 'var(--text-primary)', margin: 0 }}>Runtime Configuration</h3>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>Read-Only</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
              <ShieldCheck size={48} color="var(--border)" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', margin: '0 0 24px 0' }}>
                Live database parameter inspection (e.g. max_connections, shared_buffers) requires the telemetry collector.
              </p>
              <span className="roadmap-badge">Engine telemetry · Roadmap</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DatabaseMonitoringPage() {
  const [data, setData]           = useState<DbData|null>(null);
  const [loading, setLoading]     = useState(true);
  
  // Filters
  const [search, setSearch]           = useState("");
  const [engineFilter, setEngineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [envFilter, setEnvFilter]     = useState("all");
  const [serverFilter, setServerFilter] = useState("all");
  
  // Dropdown UI states
  const [serverDropOpen, setServerDropOpen] = useState(false);
  const [engineDropOpen, setEngineDropOpen] = useState(false);
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const [envDropOpen, setEnvDropOpen] = useState(false);

  // Expanded row
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: "1", page_size: "100", sort_by: "name", sort_dir: "asc" });
      if(search) params.set("search", search);
      if(engineFilter !== "all") params.set("engine", engineFilter);
      if(statusFilter !== "all") params.set("status", statusFilter);
      if(envFilter !== "all") params.set("environment", envFilter);
      if(serverFilter !== "all") params.set("server_id", serverFilter);

      const dbRes = await api.get(`/databases?${params.toString()}`);
      setData(dbRes.data);
    } catch(e:any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, engineFilter, statusFilter, envFilter, serverFilter]);

  // Debounced auto-fetch on filter change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      fetchAll();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, engineFilter, statusFilter, envFilter, serverFilter, fetchAll]);

  // Auto-refresh timer
  useEffect(() => {
    const timer = setInterval(() => fetchAll(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // Derived arrays for dropdowns
  const serversList = useMemo(() => {
    if (!data?.items) return [];
    const unique = Array.from(new Set(data.items.map(i => i.server_name)));
    return unique.sort();
  }, [data?.items]);

  const envsList = useMemo(() => {
    return data?.environments || [];
  }, [data?.environments]);

  const total = data?.total ?? 0;
  const healthy = data?.healthy ?? 0;
  const critical = data?.critical ?? 0;

  // Custom Inline Metric Card to match design tokens
  const renderMetricCard = (label: string, value: any, Icon: any, color: string, pulse: boolean = false) => (
    <div className="metric-card" style={{ height: 110 }}>
      <div className="metric-card-label">
        <Icon size={14} style={{ color: `var(--${color})` }} />
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="metric-card-value" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {loading ? <span style={{ opacity: 0.5 }}>--</span> : value}
        {!loading && pulse && value > 0 && (
          <span style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: `var(--${color})`, 
            boxShadow: `0 0 8px var(--${color})`, 
            animation: 'pulse-dot 2s infinite' 
          }} />
        )}
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Hero Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-full)', color: 'var(--color-blue)', fontSize: 'var(--font-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            <Database size={12} />
            Data Store Hub
          </div>
          <h1 style={{ fontSize: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            Database Fleet
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-md)', margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
            Enterprise-grade visualization of all relational and document database instances across your infrastructure.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: 8, borderRadius: 'var(--radius-md)' }}>
            <ShieldCheck size={20} color="var(--color-blue)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>System Visibility</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Global Auditing Active</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {renderMetricCard('Total Databases', total, LayoutGrid, 'color-blue')}
        {renderMetricCard('Healthy Instances', healthy, PlayCircle, 'color-healthy', true)}
        {renderMetricCard('Critical Issues', critical, AlertCircle, 'color-red')}
        {renderMetricCard('Avg Cluster Memory', `${(data?.avg_ram||0).toFixed(1)}%`, MemoryStick, 'color-purple')}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', width: 220, maxWidth: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              placeholder="Search databases..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-blue)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          {/* Engine Filter */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setEngineDropOpen(!engineDropOpen); setServerDropOpen(false); setStatusDropOpen(false); setEnvDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 140 }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{engineFilter === 'all' ? 'All Engines' : engineFilter}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {engineDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4, maxHeight: 250, overflowY: 'auto' }}>
                <div onClick={() => { setEngineFilter('all'); setEngineDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: engineFilter === 'all' ? 'var(--bg-hover)' : 'transparent' }}>All Engines</div>
                {ALL_ENGINES.map(e => (
                  <div key={e} onClick={() => { setEngineFilter(e); setEngineDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: engineFilter === e ? 'var(--bg-hover)' : 'transparent', display: 'flex', gap: 6 }}>
                    <span>{ENGINE_ICONS[e]}</span> {e}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Server Filter */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setServerDropOpen(!serverDropOpen); setEngineDropOpen(false); setStatusDropOpen(false); setEnvDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 140 }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{serverFilter === 'all' ? 'All Servers' : serverFilter}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {serverDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4, maxHeight: 250, overflowY: 'auto' }}>
                <div onClick={() => { setServerFilter('all'); setServerDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: serverFilter === 'all' ? 'var(--bg-hover)' : 'transparent' }}>All Servers</div>
                {serversList.map(s => (
                  <div key={s} onClick={() => { setServerFilter(s); setServerDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: serverFilter === s ? 'var(--bg-hover)' : 'transparent' }}>{s}</div>
                ))}
              </div>
            )}
          </div>
          
          {/* Status Filter */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setStatusDropOpen(!statusDropOpen); setServerDropOpen(false); setEngineDropOpen(false); setEnvDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 130 }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{statusFilter === 'all' ? 'All Status' : statusFilter}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {statusDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4 }}>
                {['all', 'Healthy', 'Warning', 'Critical', 'Stale'].map(s => (
                  <div key={s} onClick={() => { setStatusFilter(s); setStatusDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: statusFilter === s ? 'var(--bg-hover)' : 'transparent' }}>{s === 'all' ? 'All Status' : s}</div>
                ))}
              </div>
            )}
          </div>

          {/* Environment Filter */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setEnvDropOpen(!envDropOpen); setServerDropOpen(false); setEngineDropOpen(false); setStatusDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 120 }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{envFilter === 'all' ? 'All Envs' : envFilter}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {envDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4 }}>
                <div onClick={() => { setEnvFilter('all'); setEnvDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: envFilter === 'all' ? 'var(--bg-hover)' : 'transparent' }}>All Envs</div>
                {envsList.map(e => (
                  <div key={e} onClick={() => { setEnvFilter(e); setEnvDropOpen(false); }} style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: envFilter === e ? 'var(--bg-hover)' : 'transparent' }}>{e}</div>
                ))}
              </div>
            )}
          </div>

        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
            <Clock size={12} />
            {data?.collected_at ? `Synced: ${new Date(data.collected_at).toLocaleTimeString()}` : 'Not synced'}
          </span>
          <button 
            onClick={() => { setLoading(true); fetchAll(); }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-blue)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background 0.2s' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--color-blue-dim)' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--color-blue)' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 40, padding: '12px 16px' }}></th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Database</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Engine</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Server & Env</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>CPU / Mem</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading database instances...
                  </td>
                </tr>
              ) : (data?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 80, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <Database size={32} color="var(--text-muted)" />
                      <p style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>No database instances found</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>Adjust your filters to see more results.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data!.items.map((db) => {
                  const isExpanded = expandedRow === db.id;
                  
                  return (
                    <React.Fragment key={db.id}>
                      <tr 
                        onClick={() => setExpandedRow(isExpanded ? null : db.id)}
                        style={{ borderBottom: '1px solid var(--border)', background: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '16px' }}>
                          <ChevronRight size={16} color={isExpanded ? 'var(--color-blue)' : 'var(--text-muted)'} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{ENGINE_ICONS[db.engine] || "📦"}</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{db.database_name}</span>
                              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{db.container_id?.slice(0, 10)}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                             <span style={{ fontSize: 'var(--font-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontWeight: 500, alignSelf: 'flex-start' }}>
                               {db.engine}
                             </span>
                             <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>v{db.engine_version}</span>
                           </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                             <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>{db.server_name}</span>
                             <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Env: {db.server_env}</span>
                           </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 60 }}>
                              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>CPU {db.cpu_percent.toFixed(1)}%</span>
                              <div style={{ height: 4, width: 60, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, db.cpu_percent)}%`, background: db.cpu_percent > 80 ? 'var(--color-red)' : 'var(--color-blue)' }} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 60 }}>
                              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>RAM {db.memory_percent.toFixed(1)}%</span>
                              <div style={{ height: 4, width: 60, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, db.memory_percent)}%`, background: db.memory_percent > 80 ? 'var(--color-red)' : 'var(--color-purple)' }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <span style={{ 
                            fontSize: 'var(--font-xs)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600,
                            background: db.status === 'Healthy' ? 'rgba(16, 185, 129, 0.1)' : db.status === 'Warning' ? 'rgba(245, 158, 11, 0.1)' : db.status === 'Critical' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-input)',
                            border: `1px solid ${db.status === 'Healthy' ? 'rgba(16, 185, 129, 0.2)' : db.status === 'Warning' ? 'rgba(245, 158, 11, 0.2)' : db.status === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-subtle)'}`,
                            color: db.status === 'Healthy' ? 'var(--color-healthy)' : db.status === 'Warning' ? 'var(--color-warning)' : db.status === 'Critical' ? 'var(--color-red)' : 'var(--text-muted)'
                          }}>
                            {db.status}
                          </span>
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <ExpandedDetail item={db} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
