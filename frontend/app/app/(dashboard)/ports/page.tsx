"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import {
  PlugZap, Globe, ShieldAlert,
  Container as ContainerIcon, RefreshCw, Search, ChevronLeft,
  ChevronRight, Info, ArrowUpDown, Network, Activity,
  Eye, Lock, Server, Cpu
} from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface PortRecord {
  server_id: string;
  server_name: string;
  ip_address: string;
  protocol: string;
  state: string;
  port: number;
  bind_address: string;
  bind_scope: "LOCAL" | "HOST" | "WIDE";
  service: string;
  process_name: string | null;
  pid: number | null;
  container_id: string | null;
  container_name: string | null;
  container_port: number | null;
  image: string | null;
  network_mode: string | null;
  source: "host" | "docker" | "nginx";
  first_seen: string | null;
  last_seen: string | null;
  freshness: "live" | "stale";
  environment: string;
  server_status: string;
  nginx_server_name?: string | null;
  nginx_proxy_passes?: string[];
  nginx_resolved_upstreams?: { host: string; port: number }[];
  nginx_ssl?: boolean;
}

interface DashboardData {
  summary: {
    open_ports: number;
    wide_bind_ports: number;
    listening_services: number;
    attention_needed: number;
    docker_published_ports: number;
    nginx_routes: number;
    reporting_servers: number;
  };
  ports: PortRecord[];
  total_ports: number;
  page: number;
  page_size: number;
  top_wide_bind_ports: { port: number; count: number; pct: number }[];
  ports_by_service: { service: string; count: number; pct: number }[];
  recent_changes: { time: string; server: string; event_type: string; title: string; details: Record<string, unknown> }[];
  attention: { server: string; port: number; service: string; issue: string; severity: string; rule: string }[];
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function formatTimeAgo(isoStr: string | null): string {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function ScopeTag({ scope }: { scope: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    LOCAL: { label: "LOCAL", color: "#10b981", bg: "rgba(16,185,129,0.15)" },
    HOST: { label: "HOST", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
    WIDE: { label: "WIDE", color: "#f59e0b", bg: "rgba(245,158,11,0.2)" },
  };
  const style = map[scope] || { label: scope, color: "var(--text-secondary)", bg: "var(--bg-subtle)" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      padding: "3px 8px", borderRadius: "99px",
      color: style.color, background: style.bg, border: `1px solid ${style.color}30`,
      display: "inline-flex", alignItems: "center"
    }}>{style.label}</span>
  );
}

function StateTag({ state }: { state: string }) {
  const isListening = state === "LISTENING" || state === "UDP_LISTENING";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      padding: "3px 8px", borderRadius: "99px", display: "inline-flex", alignItems: "center", gap: "6px",
      color: isListening ? "#10b981" : "var(--text-secondary)",
      background: isListening ? "rgba(16,185,129,0.1)" : "var(--bg-subtle)",
      border: `1px solid ${isListening ? "rgba(16,185,129,0.2)" : "var(--border-subtle)"}`,
    }}>
      {isListening && <span className="pulse-dot-small" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />}
      {state === "UDP_LISTENING" ? "UDP LIST." : state}
    </span>
  );
}

function SourceTag({ source }: { source: string }) {
  const map: Record<string, { color: string, icon: any }> = {
    host: { color: "#94a3b8", icon: Server },
    docker: { color: "#38bdf8", icon: ContainerIcon },
    nginx: { color: "#a78bfa", icon: Network },
  };
  const config = map[source] || { color: "var(--text-muted)", icon: Cpu };
  const Icon = config.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: config.color, fontWeight: 600, padding: "3px 8px", background: `${config.color}15`, borderRadius: "99px", border: `1px solid ${config.color}30` }}>
      <Icon size={12} />
      {source.toUpperCase()}
    </span>
  );
}

function SummaryCard({ title, value, sub, icon: Icon, color = "var(--color-blue)", tooltip }: {
  title: string; value: number | string; sub: string;
  icon: React.ElementType; color?: string; tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="premium-metric-card" style={{ '--accent': color } as any}>
      <div className="premium-metric-bg"></div>
      <div style={{ position: "relative", zIndex: 2 }}>
        <div className="metric-card-label" style={{ color: "var(--text-secondary)" }}>
          <div style={{ padding: 6, borderRadius: 8, background: `${color}15`, color: color }}>
            <Icon size={14} />
          </div>
          {title}
          {tooltip && (
            <span style={{ position: "relative", display: "inline-flex", cursor: "help" }}
              onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
              <Info size={12} style={{ color: "var(--text-muted)", marginLeft: 4 }} />
              {showTip && (
                <span className="tooltip-content">{tooltip}</span>
              )}
            </span>
          )}
        </div>
        <div className="metric-card-value" style={{ marginTop: 8, color: color !== "var(--color-blue)" ? color : "var(--text-primary)", fontSize: "28px", fontWeight: 700, textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
          {value}
        </div>
        <div className="metric-card-sub" style={{ marginTop: 2, opacity: 0.8, fontSize: "12px" }}>{sub}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Page
import { useFilter } from "@/lib/FilterContext";

export default function PortsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const { envFilter, setEnvFilter, serverFilter, setServerFilter, environments, servers: ctxServers } = useFilter();
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("port_asc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [autoRefresh] = useState(10000);

  // Selection
  const [selectedPort, setSelectedPort] = useState<PortRecord | null>(null);
  const selectedKeyRef = useRef<string | null>(null);

  // Server list for filter
  const [servers, setServers] = useState<{ id: string; name: string; environment: string }[]>([]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (envFilter !== "all") params.set("environment", envFilter);
    if (serverFilter !== "all") params.set("server_id", serverFilter);
    if (protocolFilter !== "all") params.set("protocol", protocolFilter);
    if (scopeFilter !== "all") params.set("bind_scope", scopeFilter);
    if (search) params.set("search", search);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    return params.toString();
  }, [envFilter, serverFilter, protocolFilter, scopeFilter, search, sort, page, pageSize]);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await api.get(`/ports/dashboard?${buildQueryString()}`);
      setData(res.data);
      setError(null);
      setLastUpdated(new Date());

      // Restore selection if port still exists
      if (selectedKeyRef.current && res.data.ports) {
        const found = res.data.ports.find((p: PortRecord) =>
          `${p.server_id}:${p.protocol}:${p.bind_address}:${p.port}` === selectedKeyRef.current
        );
        if (found) setSelectedPort(found);
        else if (selectedPort) {
          // Port disappeared — keep stale notice briefly then clear
          setSelectedPort(prev => prev ? { ...prev, freshness: "stale" } : null);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load port data");
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [buildQueryString, selectedPort]);

  // Load server list for filter dropdown
  useEffect(() => {
    api.get("/servers").then((res: any) => {
      const raw = res.data;
      const srvs: { id: string; name: string; environment: string }[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.servers)
          ? raw.servers
          : [];
      setServers(srvs.map(s => ({ id: s.id, name: s.name, environment: s.environment })));
      // Case-insensitive dedup, keep first encountered casing
      const seen = new Map<string, string>();
      srvs.forEach(s => { if (s.environment && !seen.has(s.environment.toLowerCase())) seen.set(s.environment.toLowerCase(), s.environment); });
    }).catch(() => { });
  }, []);

  useEffect(() => {
    void loadData();
    if (autoRefresh > 0) {
      const t = setInterval(() => { void loadData(); }, autoRefresh);
      return () => clearInterval(t);
    }
  }, [loadData, autoRefresh]);

  const handleRowClick = (port: PortRecord) => {
    const key = `${port.server_id}:${port.protocol}:${port.bind_address}:${port.port}`;
    selectedKeyRef.current = key;
    setSelectedPort(port);
  };

  const filteredServers = envFilter === "all"
    ? servers
    : servers.filter(s => s.environment.toLowerCase() === envFilter.toLowerCase());

  const totalPages = data ? Math.ceil(data.total_ports / pageSize) : 1;

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <PageTransition>
      <style dangerouslySetInnerHTML={{__html: `
        .premium-metric-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .premium-metric-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top right, var(--accent) 0%, transparent 70%);
          opacity: 0.05;
          transition: opacity 0.3s ease;
        }
        .premium-metric-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: 0 12px 24px -10px var(--accent);
        }
        .premium-metric-card:hover .premium-metric-bg {
          opacity: 0.15;
        }
        .tooltip-content {
          position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: 100;
          background: rgba(17,24,39,0.95); backdrop-filter: blur(4px); border: 1px solid var(--border-subtle);
          border-radius: 8px; padding: 8px 12px; font-size: 11px;
          color: var(--text-primary); white-space: nowrap; box-shadow: var(--shadow-md);
        }
        .premium-layout {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .premium-left {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .premium-right {
          width: 340px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: sticky;
          top: 20px;
        }
        @media (max-width: 1100px) {
          .premium-layout {
            flex-direction: column;
          }
          .premium-right {
            width: 100%;
            position: static;
          }
        }
        .bottom-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        @media (max-width: 1400px) {
          .bottom-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 900px) {
          .bottom-grid {
            grid-template-columns: 1fr;
          }
        }
        .data-table-row {
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 1px solid var(--border-subtle);
        }
        .data-table-row:hover {
          background: var(--bg-hover) !important;
        }
        .data-table-row.selected {
          background: rgba(59,130,246,0.08) !important;
          box-shadow: inset 3px 0 0 var(--color-blue);
        }
        .glass-panel {
          background: linear-gradient(145deg, var(--bg-card) 0%, rgba(17,24,39,0.95) 100%);
          border: 1px solid var(--border-subtle);
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(12px);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }
        .premium-select {
          appearance: none;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          padding: 8px 32px 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23a1b0c7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3 5 6 8 9 5'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }
        .premium-select:hover { border-color: var(--color-blue); }
        .premium-select:focus { border-color: var(--color-blue); outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        .premium-btn {
          background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary);
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .premium-btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--color-blue); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        @keyframes pulse-small {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .pulse-dot-small { animation: pulse-small 2s infinite; }
      `}} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ padding: 8, background: "rgba(59,130,246,0.1)", borderRadius: 10 }}>
                <PlugZap size={24} color="var(--color-blue)" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                Network Ports
              </h1>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
              Enterprise-grade visibility into open ports, listening services, and bind scopes across your entire infrastructure.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="glass-panel" style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <select value={envFilter} onChange={e => { setEnvFilter(e.target.value); setPage(1); }} className="premium-select">
            <option value="all">All Environments</option>
            {environments.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          <select value={serverFilter} onChange={e => { setServerFilter(e.target.value); setPage(1); }} className="premium-select">
            <option value="all">All Servers</option>
            {filteredServers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={protocolFilter} onChange={e => { setProtocolFilter(e.target.value); setPage(1); }} className="premium-select">
            <option value="all">All Protocols</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>

          <select value={scopeFilter} onChange={e => { setScopeFilter(e.target.value); setPage(1); }} className="premium-select">
            <option value="all">All Scopes</option>
            <option value="WIDE">Wide Bind</option>
            <option value="HOST">Host Bind</option>
            <option value="LOCAL">Localhost</option>
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="pulse-dot-small" style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", letterSpacing: "0.05em" }}>LIVE SYNC</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            {lastUpdated && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                Refreshed {formatTimeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <button
              onClick={() => loadData(true)}
              className="premium-btn"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {loading && !data && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px", opacity: 0.5 }} />
            Loading Enterprise Port Inventory...
          </div>
        )}
        {error && (
          <div style={{ color: "var(--color-critical)", padding: 20, background: "rgba(239,68,68,0.1)", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 16 }}>
            <ShieldAlert size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Connection Error</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{error}</div>
            </div>
            <button onClick={() => loadData(true)} className="premium-btn">Retry Connection</button>
          </div>
        )}

        {data && (<>
          {/* 6 Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
            <SummaryCard
              title="OPEN PORTS" icon={PlugZap}
              value={data.summary.open_ports}
              sub={`${data.summary.reporting_servers} connected nodes`}
            />
            <SummaryCard
              title="WIDE-BIND PORTS" icon={Globe}
              value={data.summary.wide_bind_ports}
              color="var(--color-warning)"
              sub="Exposed to 0.0.0.0"
              tooltip="Bound to all network interfaces. Requires strict security grouping."
            />
            <SummaryCard
              title="ACTIVE SERVICES" icon={Activity}
              value={data.summary.listening_services}
              sub="Unique listening apps"
              color="var(--color-teal)"
            />
            <SummaryCard
              title="ATTENTION FLAGS" icon={ShieldAlert}
              value={data.summary.attention_needed}
              color={data.summary.attention_needed > 0 ? "var(--color-critical)" : "var(--color-healthy)"}
              sub="Policy mismatches detected"
            />
            <SummaryCard
              title="DOCKER EXPORTS" icon={ContainerIcon}
              value={data.summary.docker_published_ports}
              sub="Container network binds"
              color="var(--color-blue)"
            />
            <SummaryCard
              title="INGRESS ROUTES" icon={Network}
              value={data.summary.nginx_routes}
              sub="Proxied through NGINX"
              color="var(--color-purple)"
            />
          </div>

          {/* Main Layout */}
          <div className="premium-layout">
            
            {/* Left Column */}
            <div className="premium-left">
              
              {/* Port Inventory Data Grid */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", background: "rgba(0,0,0,0.2)" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    Enterprise Port Inventory
                    <span style={{ padding: "4px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "99px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                      {data.total_ports} Records
                    </span>
                  </h3>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search size={14} style={{ position: "absolute", left: 12, color: "var(--text-muted)" }} />
                    <input
                      type="text" placeholder="Search resources..." value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "8px 12px 8px 34px", borderRadius: 8, fontSize: 13, width: 260, transition: "all 0.2s" }}
                      onFocus={e => e.currentTarget.style.borderColor = "var(--color-blue)"}
                      onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                    />
                  </div>
                  <select value={sort} onChange={e => setSort(e.target.value)} className="premium-select" style={{ background: "var(--bg-card)" }}>
                    <option value="port_asc">Sort: Port Ascending</option>
                    <option value="port_desc">Sort: Port Descending</option>
                    <option value="server">Sort: Server Name</option>
                    <option value="attention">Sort: Attention Needed</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflow: "auto", maxHeight: "550px", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(17,24,39,0.95)", backdropFilter: "blur(4px)" }}>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["SERVER", "IP / ADDR", "PORT", "PROTO", "STATUS", "SERVICE", "PROCESS", "SOURCE"].map(h => (
                        <th key={h} style={{ padding: "14px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.ports.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                          <ShieldAlert size={32} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                          {search ? "No records match your query." : "Inventory empty or pending sync."}
                        </td>
                      </tr>
                    ) : data.ports.map((p, i) => {
                      const key = `${p.server_id}:${p.protocol}:${p.bind_address}:${p.port}`;
                      const isSelected = selectedPort && `${selectedPort.server_id}:${selectedPort.protocol}:${selectedPort.bind_address}:${selectedPort.port}` === key;
                      const isStale = p.freshness === "stale";
                      const hasAttention = _attention_score_fe(p) > 0;
                      return (
                        <tr key={i} onClick={() => handleRowClick(p)} className={`data-table-row ${isSelected ? 'selected' : ''}`} style={{ opacity: isStale ? 0.5 : 1 }}>
                          <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {hasAttention && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-critical)", boxShadow: "0 0 8px var(--color-critical)" }} />}
                              {p.server_name}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ color: "var(--text-primary)" }}>{p.ip_address}</span>
                              <span style={{ fontSize: 11, opacity: 0.7 }}>{p.bind_address}</span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{p.port}</td>
                          <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontWeight: 600, fontSize: 12 }}>{p.protocol.toUpperCase()}</td>
                          <td style={{ padding: "14px 16px" }}><StateTag state={p.state} /></td>
                          <td style={{ padding: "14px 16px", color: "var(--text-primary)", fontWeight: 500 }}>{p.service || "—"}</td>
                          <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                            {p.process_name
                              ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Cpu size={12} /> {p.process_name}</div>
                              : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Restricted</span>}
                          </td>
                          <td style={{ padding: "14px 16px" }}><SourceTag source={p.source} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--text-secondary)", background: "rgba(0,0,0,0.2)" }}>
                  <span style={{ fontWeight: 500 }}>Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, data.total_ports)} of {data.total_ports}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="premium-btn" style={{ padding: "6px 10px" }}>
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pg = i + 1;
                      return (
                        <button key={pg} onClick={() => setPage(pg)} className="premium-btn" style={{ padding: "6px 14px", background: page === pg ? "var(--color-blue)" : undefined, color: page === pg ? "#fff" : undefined, borderColor: page === pg ? "var(--color-blue)" : undefined }}>
                          {pg}
                        </button>
                      );
                    })}
                    {totalPages > 5 && <span style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>...</span>}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="premium-btn" style={{ padding: "6px 10px" }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Analytics Grid */}
            <div className="bottom-grid">
            
            {/* Top Wide-Bind Ports */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "rgba(245,158,11,0.05)" }}>
                <Globe size={18} color="var(--color-warning)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Top Wide-Bind Exposures</h3>
              </div>
              <div style={{ padding: 20, flex: 1 }}>
                {data.top_wide_bind_ports.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Optimal configuration. No wide-binds detected.</div>
                ) : data.top_wide_bind_ports.map((row, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>PORT {row.port}</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{row.count} Nodes <span style={{ opacity: 0.5 }}>|</span> {row.pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: "99px", background: "rgba(255,255,255,0.05)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)" }}>
                      <div style={{ height: "100%", width: `${row.pct}%`, background: "linear-gradient(90deg, var(--color-warning), #fbbf24)", borderRadius: "99px", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ports by Service */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "rgba(59,130,246,0.05)" }}>
                <Activity size={18} color="var(--color-blue)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Service Distribution</h3>
              </div>
              <div style={{ padding: 20, flex: 1 }}>
                {data.ports_by_service.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Telemetry unavailable.</div>
                ) : data.ports_by_service.map((row, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 12 }}>{row.service}</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{row.count} Ports <span style={{ opacity: 0.5 }}>|</span> {row.pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: "99px", background: "rgba(255,255,255,0.05)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)" }}>
                      <div style={{ height: "100%", width: `${row.pct}%`, background: "linear-gradient(90deg, var(--color-blue), #60a5fa)", borderRadius: "99px", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Port Changes */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,0.05)" }}>
                <ArrowUpDown size={18} color="var(--color-healthy)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Infrastructure Events</h3>
              </div>
              <div style={{ padding: "12px 0", maxHeight: 300, overflowY: "auto", flex: 1 }}>
                {data.recent_changes.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "30px 20px" }}>No topology changes detected.</div>
                ) : data.recent_changes.map((ev, i) => {
                  const isStart = ev.event_type === "port_started";
                  const isStop = ev.event_type === "port_stopped";
                  const dot = isStart ? "#10b981" : isStop ? "var(--color-critical)" : "var(--color-warning)";
                  return (
                    <div key={i} style={{ padding: "10px 20px", display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                      {i !== data.recent_changes.length - 1 && <div style={{ position: "absolute", left: 24, top: 24, bottom: -10, width: 2, background: "var(--border-subtle)", zIndex: 0 }} />}
                      <span style={{ marginTop: 5, width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0, zIndex: 1, boxShadow: `0 0 10px ${dot}80`, border: "2px solid var(--bg-card)" }} />
                      <div style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 4 }}>
                          {formatTime(ev.time)} <span style={{ margin: "0 6px" }}>•</span> {ev.server}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>{ev.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <AttentionPanel items={data.attention} />
          </div>
          </div>

          {/* Right Column */}
          <div className="premium-right">
            <SelectedPortDetails port={selectedPort} />
          </div>

        </div>
        </>)}
      </div>
    </PageTransition>
  );
}

// ─────────────────────────────────────────
// Selected Port Details
// ─────────────────────────────────────────
function SelectedPortDetails({ port }: { port: PortRecord | null }) {
  if (!port) {
    return (
      <div className="glass-panel" style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, borderStyle: "dashed", borderColor: "var(--border-subtle)" }}>
        <Eye size={32} style={{ color: "var(--border)", marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Resource Inspector</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4, textAlign: "center", maxWidth: 200, lineHeight: 1.4 }}>
          Select a port from the grid to inspect details.
        </div>
      </div>
    );
  }

  if (port.freshness === "stale") {
    return (
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--color-critical)", background: "rgba(239,68,68,0.1)", padding: 16, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
          <ShieldAlert size={20} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Port Offline. Resource terminated in latest telemetry sync.</div>
        </div>
      </div>
    );
  }

  const hasDocker = !!port.container_name;
  const hasNginx = !!(port.nginx_server_name || (port.nginx_proxy_passes && port.nginx_proxy_passes.length > 0));

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Resource Identity</h3>
        <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: "99px", background: "rgba(59,130,246,0.15)", color: "var(--color-blue)", fontWeight: 800, letterSpacing: "0.08em" }}>INSPECT MODE</span>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        
        {/* Top Info Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4 }}>BIND ADDRESS</div>
            <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{port.bind_address}</div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4 }}>PORT / PROTOCOL</div>
            <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 700 }}>{port.port} <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{port.protocol.toUpperCase()}</span></div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

        <DetailRow label="Node Host" value={port.server_name} />
        <DetailRow label="Node IP" value={port.ip_address} mono />
        <DetailRow label="Status" value={<StateTag state={port.state} />} raw />
        <DetailRow label="Exposure Level" value={<ScopeTag scope={port.bind_scope} />} raw />
        <DetailRow label="Source" value={<SourceTag source={port.source} />} raw />
        
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
        
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.1em", marginTop: 8, marginBottom: 4 }}>SYSTEM LAYER</div>
        <DetailRow label="Service Identity" value={port.service || "Unknown"} bold />
        <DetailRow label="Process Exec" value={port.process_name || "Access Restricted"} mono={!!port.process_name} />
        <DetailRow label="Process ID" value={port.pid ? String(port.pid) : "Unknown"} mono />

        {hasDocker && (<>
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 }}>
            <ContainerIcon size={14} color="#38bdf8" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.1em" }}>DOCKER VIRTUALIZATION</span>
          </div>
          <DetailRow label="Container" value={port.container_name!} mono />
          <DetailRow label="Internal Port" value={port.container_port ? String(port.container_port) : "—"} mono />
          <DetailRow label="Networking" value={port.network_mode || "—"} />
          
          <div style={{ background: "rgba(56,189,248,0.05)", padding: 12, borderRadius: 8, border: "1px dashed rgba(56,189,248,0.3)", marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 8 }}>TRAFFIC ROUTING</div>
            <RelationshipChain
              items={[
                { label: `Host :${port.port}`, type: "host" },
                { label: "bridge", type: "arrow" },
                { label: `${port.container_name} :${port.container_port}`, type: "container" },
              ]}
            />
          </div>
        </>)}

        {hasNginx && (<>
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 }}>
            <Network size={14} color="#a78bfa" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: "0.1em" }}>NGINX INGRESS</span>
          </div>
          {port.nginx_server_name && <DetailRow label="Server Name" value={port.nginx_server_name} />}
          {port.nginx_ssl !== undefined && <DetailRow label="SSL Termination" value={port.nginx_ssl ? "Enabled" : "Disabled"} />}
          
          {port.nginx_proxy_passes && port.nginx_proxy_passes.length > 0 && (
            <div style={{ background: "rgba(167,139,250,0.05)", padding: 12, borderRadius: 8, border: "1px dashed rgba(167,139,250,0.3)", marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 8 }}>REVERSE PROXY TOPOLOGY</div>
              <RelationshipChain
                items={[
                  { label: `Ingress :${port.port}`, type: "host" },
                  { label: "proxy_pass", type: "arrow" },
                  { label: port.nginx_proxy_passes[0], type: "docker" },
                  ...(port.nginx_resolved_upstreams && port.nginx_resolved_upstreams.length > 0
                    ? [{ label: `${port.nginx_resolved_upstreams[0].host}:${port.nginx_resolved_upstreams[0].port}`, type: "container" }]
                    : [])
                ]}
              />
            </div>
          )}
        </>)}
        
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          <span>First discovered: {formatTimeAgo(port.first_seen)}</span>
          <span>Last sync: {formatTimeAgo(port.last_seen)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false, bold = false, raw = false }: {
  label: string; value: React.ReactNode | string;
  mono?: boolean; bold?: boolean; raw?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      {raw ? value : (
        <span style={{
          fontSize: 13, color: "var(--text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
          fontWeight: bold ? 600 : 400,
          textAlign: "right", wordBreak: "break-all"
        }}>{value}</span>
      )}
    </div>
  );
}

function RelationshipChain({ items }: { items: { label: string; type: string }[] }) {
  const colorMap: Record<string, string> = {
    host: "#60a5fa", docker: "#38bdf8", container: "#a78bfa",
    service: "#10b981", arrow: "var(--text-muted)"
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && item.type === "arrow" && <span style={{ color: "var(--text-muted)" }}>→</span>}
          {i > 0 && item.type !== "arrow" && items[i-1].type !== "arrow" && <span style={{ color: "var(--text-muted)" }}>→</span>}
          {item.type !== "arrow" && (
            <span style={{ 
              color: colorMap[item.type] || "var(--text-secondary)", 
              fontFamily: "var(--font-mono)", 
              fontSize: 11,
              padding: "4px 8px",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 6,
              border: `1px solid ${colorMap[item.type]}40`
            }}>
              {item.label}
            </span>
          )}
          {item.type === "arrow" && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Attention Panel
// ─────────────────────────────────────────
function AttentionPanel({ items }: { items: any[] }) {
  const severityColor = (s: string) => s === "warning" ? "var(--color-critical)" : "var(--color-warning)";
  
  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.05)" }}>
        <ShieldAlert size={18} color="var(--color-critical)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Security Policy Flags</h3>
        {items.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#fff", background: "var(--color-critical)", padding: "2px 8px", borderRadius: "99px" }}>{items.length} ACTIVE</span>}
      </div>
      <div style={{ padding: "12px 0", maxHeight: 300, overflowY: "auto", flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "30px 20px" }}>Zero policy violations detected.</div>
        ) : items.slice(0, 10).map((item, i) => (
          <div key={i} style={{ padding: "10px 20px", display: "flex", gap: 12, alignItems: "flex-start", borderBottom: i !== items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <div style={{ padding: 6, background: `${severityColor(item.severity)}20`, borderRadius: 8, color: severityColor(item.severity) }}>
              <ShieldAlert size={14} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.server}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>{item.issue}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Frontend attention score helper
// ─────────────────────────────────────────
function _attention_score_fe(port: PortRecord): number {
  const SENSITIVE = ["postgres", "mysqld", "mongod", "redis", "sqlservr", "oracle", "rabbitmq", "beam.smp", "docker", "kubelet", "elasticsearch"];
  const svc = (port.service || "").toLowerCase();
  const proc = (port.process_name || "").toLowerCase();
  const scope = port.bind_scope;
  let score = 0;
  if (scope === "WIDE") {
    if (SENSITIVE.some(p => svc.includes(p) || proc.includes(p))) score += 10;
    if (svc === "ssh" || proc === "sshd" || port.port === 22) score += 5;
  }
  if (!port.process_name && !port.container_name) score += 3;
  return score;
}
