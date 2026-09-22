/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Server as ServerIcon, Play, RefreshCw,
  Search, Cpu, MemoryStick, Activity,
  ChevronLeft, ChevronRight, Copy, CheckCircle, Info,
  AlertTriangle, RotateCw, X, Box, Clock,
  Image as ImageIcon, Database
} from "lucide-react";
import api from "@/lib/api";
import { formatLastSeen } from "@/lib/formatters";
import { EnvironmentSelect } from "@/components/ui/EnvironmentSelect";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type { Server } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return "—";
  const n = typeof bytes === "string" ? parseFloat(bytes) : bytes;
  if (isNaN(n)) return "—";
  if (n === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return parseFloat((n / Math.pow(1024, i)).toFixed(1)) + " " + sizes[i];
}

function stateBadge(state: string | null | undefined) {
  if (!state) return <span className="status-badge badge-offline" style={{ padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Unknown</span>;
  const s = String(state).toLowerCase();
  switch (s) {
    case 'running': return <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, border: "1px solid rgba(34,197,94,0.2)" }}>RUNNING</span>;
    case 'restarting': return <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, border: "1px solid rgba(245,158,11,0.2)" }}>RESTARTING</span>;
    case 'exited': return <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, border: "1px solid rgba(239,68,68,0.2)" }}>EXITED</span>;
    case 'dead': return <span style={{ background: "rgba(220,38,38,0.2)", color: "#f87171", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, border: "1px solid rgba(220,38,38,0.3)" }}>DEAD</span>;
    case 'paused': return <span style={{ background: "rgba(102,153,255,0.15)", color: "#99bbff", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, border: "1px solid rgba(102,153,255,0.2)" }}>PAUSED</span>;
    default: return <span className="status-badge badge-offline" style={{ padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{state.toUpperCase()}</span>;
  }
}

function healthBadge(health: string | null | undefined) {
  if (!health || health === "N/A" || health === "NO HEALTHCHECK") return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
  const h = String(health).toLowerCase();
  if (h === "healthy") return <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.5)" }} /><span style={{ color: "#22c55e", fontSize: 12, fontWeight: 500 }}>Healthy</span></div>;
  if (h === "unhealthy") return <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.5)" }} /><span style={{ color: "#ef4444", fontSize: 12, fontWeight: 500 }}>Unhealthy</span></div>;
  if (h === "starting") return <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} /><span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 500 }}>Starting</span></div>;
  return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{health}</span>;
}

function UptimeDisplay({ created_at }: { created_at: string | null }) {
  if (!created_at) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const start = new Date(created_at).getTime();
  const now = Date.now();
  const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
  const d = Math.floor(diffSecs / 86400);
  const h = Math.floor((diffSecs % 86400) / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  if (d > 0) return <span>{d}d</span>;
  if (h > 0) return <span>{h}h</span>;
  return <span>{m}m</span>;
}

function Pagination({
  page, totalPages, totalItems, pageSize,
  onPage,
}: {
  page: number; totalPages: number; totalItems: number; pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pages: (number | "…")[] = [];
  const around = new Set<number>();
  around.add(1);
  around.add(totalPages);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) around.add(i);
  const sorted = Array.from(around).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push("…");
    pages.push(sorted[i]);
  }

  const PB: React.CSSProperties = {
    minWidth: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "0 8px",
    transition: "all 0.2s"
  };
  const PBactive: React.CSSProperties = { ...PB, background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)", boxShadow: "0 0 10px rgba(59,130,246,0.3)" };
  const PBdis: React.CSSProperties = { ...PB, opacity: 0.4, cursor: "not-allowed" };

  return (
    <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "rgba(0,0,0,0.1)" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
        Showing <strong style={{ color: "var(--text-primary)" }}>{start} - {end}</strong> of {totalItems.toLocaleString()}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={page <= 1 ? PBdis : PB} className="hover:bg-[var(--bg-hover)]">
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: 13 }}>…</span>
            : <button key={p} onClick={() => onPage(p as number)} style={page === p ? PBactive : PB} className={page !== p ? "hover:bg-[var(--bg-hover)]" : ""}>{p}</button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={page >= totalPages ? PBdis : PB} className="hover:bg-[var(--bg-hover)]">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export function DockerDashboard() {
  const [data, setData] = useState<any>({
    summary: { total_containers: 0, running: 0, unhealthy: 0, restarting: 0, avg_cpu_usage: 0, avg_ram_usage: 0 },
    containers: [],
    pagination: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
    top_cpu: [], top_memory: [], recent_events: [], resource_history: [], images: [], volumes: []
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [envFilter, setEnvFilter] = useState("All Environments");
  const [serverFilter, setServerFilter] = useState("All Servers");
  const [containerFilter, setContainerFilter] = useState("All Containers");
  const [stateFilter, setStateFilter] = useState("All States");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [periodFilter, setPeriodFilter] = useState("1h");

  // Selection
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const [selectedContainerDetails, setSelectedContainerDetails] = useState<any>(null);

  // Tab for images/volumes
  const [ivTab, setIvTab] = useState<"images" | "volumes">("images");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortCol, setSortCol] = useState("cpu_percent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [servers, setServers] = useState<Server[]>([]);
  const [copied, setCopied] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 300);
  };

  useEffect(() => {
    api.get("/servers").then(res => setServers(Array.isArray(res.data) ? res.data : [])).catch(() => { });
  }, []);

  const serverOptions = useMemo(() => {
    const env = envFilter.toLowerCase();
    const list = (envFilter === "All Environments" || envFilter === "")
      ? servers
      : servers.filter(s => s.environment?.toLowerCase() === env);
    return [
      { value: "All Servers", label: "All Servers" },
      ...list.map(s => ({ value: s.id, label: s.name }))
    ];
  }, [servers, envFilter]);

  const load = useCallback(async (isAuto = false) => {
    if (!isAuto) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (envFilter !== "All Environments" && envFilter !== "") params.append("environment", envFilter);
      if (serverFilter !== "All Servers" && serverFilter !== "") params.append("server_id", serverFilter);
      if (stateFilter !== "All States" && stateFilter !== "") params.append("state", stateFilter);
      if (search) params.append("search", search);
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      params.append("period", periodFilter);

      const res = await api.get(`/docker/dashboard?${params.toString()}`);
      setData(res.data);

      setSelectedContainer((prev: any) => {
        if (!prev) return null;
        const stillExists = res.data.containers.find((c: any) => c.id === prev.id);
        return stillExists || null;
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load Docker data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [envFilter, serverFilter, stateFilter, search, page, pageSize, periodFilter]);

  useEffect(() => { load(); }, [load]);

  // Load deep details when a container is selected
  useEffect(() => {
    let active = true;
    if (selectedContainer) {
      setSelectedContainerDetails(null);
      api.get(`/containers/${selectedContainer.id}/inspect`)
        .then(res => { if (active) setSelectedContainerDetails(res.data); })
        .catch(() => { if (active) setSelectedContainerDetails(null); });
    } else {
      setSelectedContainerDetails(null);
    }
    return () => { active = false; };
  }, [selectedContainer]);

  const copyCommand = () => {
    if (selectedContainerDetails?.Path) {
      const cmd = [selectedContainerDetails.Path, ...(selectedContainerDetails.Args || [])].join(" ");
      navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { summary, containers, pagination, top_cpu, top_memory, recent_events, images, volumes } = data;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .docker-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
        }
        @media (max-width: 1400px) {
          .docker-dashboard-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 800px) {
          .docker-dashboard-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .docker-bottom-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 16px;
        }
        .premium-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease;
          overflow: hidden;
        }
        .premium-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          border-color: rgba(255,255,255,0.08);
        }
        .premium-glass {
          background: linear-gradient(145deg, rgba(30,42,63,0.2) 0%, rgba(17,24,39,0.5) 100%);
          backdrop-filter: blur(10px);
        }
        .row-hover {
          transition: background 0.15s ease;
        }
        .row-hover:hover {
          background: rgba(255,255,255,0.04);
        }
        .details-pane {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 400px;
          background: var(--bg-card);
          border-left: 1px solid var(--border);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 40px rgba(0,0,0,0.5);
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          z-index: 999;
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .progress-bar-bg {
          width: 100%;
          height: 6px;
          background: var(--bg-secondary);
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}} />
      <div className="page-container custom-scrollbar" style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", gap: 20, overflowY: "auto", paddingBottom: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <div>
            <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
              <div style={{ padding: 8, background: "rgba(59,130,246,0.15)", borderRadius: 10, color: "var(--primary)", display: "flex" }}>
                <Box size={24} />
              </div>
              Docker Engine
            </div>
            <div className="page-subtitle" style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
              Enterprise container inventory, runtime health, and comprehensive monitoring.
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="premium-card premium-glass" style={{ padding: "12px 16px", display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 180, marginRight: 24 }}><EnvironmentSelect value={envFilter} onChange={v => { setEnvFilter(v); setPage(1); }} /></div>
            <div style={{ width: 220 }}><SearchableCombobox value={serverFilter} onChange={v => { setServerFilter(v); setPage(1); }} options={serverOptions} placeholder="All Servers" /></div>
          </div>
          <select className="input-base" style={{ minWidth: 160, fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}>
            <option value="All States">All States</option>
            <option value="Running">Running</option>
            <option value="Restarting">Restarting</option>
            <option value="Exited">Exited</option>
            <option value="Paused">Paused</option>
            <option value="Dead">Dead</option>
          </select>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: 8, padding: 4, boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}>
              {["LIVE", "5m", "15m", "1h", "6h", "24h"].map(p => (
                <button
                  key={p} onClick={() => { setPeriodFilter(p); setPage(1); }}
                  style={{
                    padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
                    background: periodFilter === p || (p === 'LIVE' && periodFilter === '1h') ? "var(--bg-elevated)" : "transparent",
                    color: periodFilter === p || (p === 'LIVE' && periodFilter === '1h') ? (p === "LIVE" ? "#10b981" : "var(--text-primary)") : "var(--text-muted)",
                    boxShadow: periodFilter === p || (p === 'LIVE' && periodFilter === '1h') ? "0 2px 4px rgba(0,0,0,0.2)" : "none", display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  {p === "LIVE" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />}
                  {p}
                </button>
              ))}
            </div>

            <button className="btn-primary" onClick={() => load(false)} style={{ padding: "0 16px", height: 36, fontSize: 13, borderRadius: 8, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <RefreshCw size={14} className={refreshing ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards Grid */}
        <div className="docker-dashboard-grid">
          {[
            { label: "Total Containers", val: summary.total_containers, sub: serverFilter === "All Servers" ? `across ${servers.length} nodes` : "on node", color: "var(--primary)", bg: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.05))", Icon: ServerIcon },
            { label: "Running", val: summary.running, sub: summary.total_containers ? `${Math.round(summary.running / summary.total_containers * 100)}% uptime efficiency` : "0%", color: "#10b981", bg: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.05))", Icon: Play },
            { label: "Unhealthy", val: summary.unhealthy, sub: summary.unhealthy > 0 ? "requires immediate action" : "All checks passing", color: "#ef4444", bg: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.05))", Icon: AlertTriangle },
            { label: "Restarting", val: summary.restarting, sub: summary.restarting > 0 ? "recovering state" : "Stable", color: "#f59e0b", bg: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.05))", Icon: RotateCw },
            { label: "Avg CPU Load", val: `${summary.avg_cpu_usage}%`, sub: "fleet average", color: "#a855f7", bg: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(147,51,234,0.05))", Icon: Cpu },
            { label: "Avg RAM Usage", val: formatBytes(summary.avg_ram_usage), sub: "fleet average memory", color: "#6366f1", bg: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.05))", Icon: MemoryStick },
          ].map(({ label, val, sub, color, bg, Icon }) => (
            <div key={label} className="premium-card premium-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 12px ${color}20` }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1.2, marginTop: 4 }}>{val}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area (Inventory + Selected Details) */}
        <div className="premium-card" style={{ display: "flex", position: "relative", overflow: "hidden" }}>

          {/* Inventory */}
          <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minWidth: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Box size={20} style={{ color: "var(--primary)" }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Container Inventory <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>({summary.total_containers})</span></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div className="search-box" style={{ margin: 0, width: 280, borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border)", position: "relative" }}>
                  <Search size={14} className="search-icon" style={{ left: 12, color: "var(--text-muted)", position: "absolute", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    className="input-base" type="text" placeholder="Search containers, images, servers..."
                    value={searchInput} onChange={e => handleSearchInput(e.target.value)}
                    style={{ padding: "8px 12px 8px 36px", fontSize: 13, width: "100%", height: 36, borderRadius: 8, background: "transparent", border: "none", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>

            <div className="custom-scrollbar" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 600 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                  <tr>
                    <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Server</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Container</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Image</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>CPU</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>RAM</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Uptime</th>
                    <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && containers.length === 0
                    ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 14 }}>Loading ecosystem data...</td></tr>
                    : error
                      ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 60, color: "#ef4444", fontSize: 14 }}>{error}</td></tr>
                      : containers.length === 0
                        ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 14 }}>No containers found.</td></tr>
                        : containers.map((c: any) => (
                          <tr key={c.id}
                            className="row-hover"
                            onClick={() => setSelectedContainer(c)}
                            style={{
                              cursor: "pointer",
                              background: selectedContainer?.id === c.id ? "rgba(59,130,246,0.06)" : undefined,
                              borderLeft: selectedContainer?.id === c.id ? "3px solid var(--primary)" : "3px solid transparent",
                              borderBottom: "1px solid var(--border-subtle)",
                            }}>
                            <td style={{ padding: "14px 24px", color: "var(--text-secondary)", fontSize: 13, whiteSpace: "nowrap" }}>{c.server_name}</td>
                            <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-primary)", fontSize: 14, wordBreak: "break-all" }}>{c.name}</td>
                            <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>{stateBadge(c.status)}</td>
                            <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontSize: 13, wordBreak: "break-all" }}>{c.image?.split('@')[0]}</td>
                            <td style={{ padding: "14px 16px", textAlign: "right", fontSize: 13, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap" }}>{c.last_cpu_percent !== null ? `${c.last_cpu_percent.toFixed(1)}%` : "—"}</td>
                            <td style={{ padding: "14px 16px", textAlign: "right", fontSize: 13, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap" }}>{formatBytes(c.last_mem_usage)}</td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}><UptimeDisplay created_at={c.created_at} /></td>
                            <td style={{ padding: "14px 24px", whiteSpace: "nowrap" }}>{healthBadge(c.health_status)}</td>
                          </tr>
                        ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.total_pages} totalItems={pagination.total_items} pageSize={pagination.page_size} onPage={p => setPage(p)} />
          </div>

          {/* Selected Details Panel - Fixed Drawer */}
          {selectedContainer && (
            <>
              <div className="backdrop" onClick={() => setSelectedContainer(null)} />
              <div className="details-pane">
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-elevated)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 8px rgba(59,130,246,0.8)" }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{selectedContainer.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 10, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "4px 8px", borderRadius: 6, fontWeight: 700, letterSpacing: "0.05em", border: "1px solid rgba(245,158,11,0.2)" }}>READ-ONLY</span>
                    <button onClick={() => setSelectedContainer(null)} style={{ background: "var(--bg-secondary)", border: "none", cursor: "pointer", color: "var(--text-primary)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }} className="hover:bg-[var(--bg-hover)]">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="custom-scrollbar" style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>

                  {/* Meta Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>Node Location</div>
                      <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{selectedContainer.server_name}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>Container ID</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "monospace" }}>{selectedContainer.container_id.substring(0, 12)}</div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>Image Reference</div>
                      <div style={{ color: "var(--text-primary)", fontSize: 14 }}>{selectedContainer.image}</div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--border)" }} />

                  {/* Status & Health */}
                  <div style={{ display: "flex", gap: 32 }}>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>Runtime State</div>
                      <div>{stateBadge(selectedContainer.status)}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>Health Check</div>
                      <div>{healthBadge(selectedContainer.health_status)}</div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--border)" }} />

                  {/* Metrics */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>CPU Allocation</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{selectedContainer.last_cpu_percent !== null ? `${selectedContainer.last_cpu_percent.toFixed(1)}%` : "—"}</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(selectedContainer.last_cpu_percent || 0, 100)}%`, background: selectedContainer.last_cpu_percent > 80 ? "#ef4444" : "var(--primary)" }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Memory Utilization</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>
                          {formatBytes(selectedContainer.last_mem_usage)} / {formatBytes(selectedContainer.last_mem_limit)}
                        </span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${selectedContainer.last_mem_limit ? Math.min((selectedContainer.last_mem_usage / selectedContainer.last_mem_limit) * 100, 100) : 0}%`, background: "#8b5cf6" }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--border)" }} />

                  {/* Network & Volumes */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>Published Ports</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {selectedContainer.ports ? selectedContainer.ports.split(',').map((p: string, i: number) => <div key={i} style={{ padding: "4px 0", borderBottom: i !== selectedContainer.ports.split(',').length - 1 ? "1px solid var(--border-subtle)" : "none" }}>{p.trim()}</div>) : "No published ports"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>Mounted Volumes</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedContainerDetails?.Mounts?.length > 0 ? selectedContainerDetails.Mounts.map((m: any, i: number) => (
                          <div key={i} style={{ background: "var(--bg-secondary)", padding: 8, borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Source</div>
                            <div style={{ wordBreak: "break-all", marginBottom: 6 }}>{m.Source}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Destination ({m.Mode})</div>
                            <div style={{ wordBreak: "break-all" }}>{m.Destination}</div>
                          </div>
                        )) : "No volumes mounted"}
                      </div>
                    </div>
                  </div>

                  {/* Command */}
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Entrypoint / Command</div>
                    <div style={{ background: "#000", borderRadius: 8, padding: "14px", fontFamily: "monospace", fontSize: 12, color: "#10b981", border: "1px solid rgba(255,255,255,0.1)", position: "relative", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)" }}>
                      {selectedContainerDetails ? (
                        <>
                          <div style={{ color: "#f0f4fc", marginBottom: 6, fontWeight: 600 }}>$ {selectedContainerDetails.Path}</div>
                          {selectedContainerDetails.Args?.map((a: string, i: number) => <div key={i} style={{ paddingLeft: 16 }}>{a}</div>)}
                        </>
                      ) : "Inspecting container..."}
                      <button onClick={copyCommand} style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: copied ? "#22c55e" : "#fff", transition: "all 0.2s" }} className="hover:bg-[rgba(255,255,255,0.2)]">
                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Panels - Responsive Grid */}
        <div className="docker-bottom-grid">

          {/* Top CPU */}
          <div className="premium-card" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}><Cpu size={16} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Top Compute</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              {top_cpu.length === 0 ? <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>No metric data</div> :
                top_cpu.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 20, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ width: 44, fontSize: 13, fontWeight: 700, textAlign: "right", color: c.value > 80 ? "#ef4444" : "var(--text-primary)" }}>{c.value.toFixed(0)}%</div>
                    <div style={{ width: 80, height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(c.value, 100)}%`, background: c.value > 80 ? "#ef4444" : (c.value > 50 ? "#f59e0b" : "var(--primary)"), transition: "width 0.5s" }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Memory */}
          <div className="premium-card" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}><Database size={16} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Top Memory</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              {top_memory.length === 0 ? <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>No metric data</div> :
                top_memory.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 20, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ width: 60, fontSize: 13, fontWeight: 700, textAlign: "right", color: "var(--text-primary)" }}>{formatBytes(c.value)}</div>
                    <div style={{ width: 80, height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `50%`, background: "#6366f1" }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Recent Events */}
          {recent_events.length > 0 && (
            <div className="premium-card" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}><Clock size={16} /></div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent Events</div>
                </div>
              </div>
              <div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", maxHeight: 220, paddingRight: 8 }}>
                {recent_events.map((e: any) => (
                  <div key={e.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, paddingTop: 2 }}>{new Date(e.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: e.event_type === "die" || e.event_type === "stop" ? "#ef4444" : "var(--primary)", marginBottom: 2 }}>
                        <span style={{ color: "var(--text-primary)" }}>{e.container_name}</span> {e.event_type} {e.reason ? `(${e.reason})` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{e.server_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image / Volume Usage */}
          <div className="premium-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}><ImageIcon size={16} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Storage Insights</div>
              </div>
              <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: 8, padding: 4, border: "1px solid var(--border)" }}>
                <button onClick={() => setIvTab("images")} style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer", background: ivTab === "images" ? "var(--bg-elevated)" : "transparent", color: ivTab === "images" ? "var(--text-primary)" : "var(--text-muted)", boxShadow: ivTab === "images" ? "0 2px 4px rgba(0,0,0,0.2)" : "none", transition: "all 0.2s" }}>Images</button>
                <button onClick={() => setIvTab("volumes")} style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer", background: ivTab === "volumes" ? "var(--bg-elevated)" : "transparent", color: ivTab === "volumes" ? "var(--text-primary)" : "var(--text-muted)", boxShadow: ivTab === "volumes" ? "0 2px 4px rgba(0,0,0,0.2)" : "none", transition: "all 0.2s" }}>Volumes</button>
              </div>
            </div>

            <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", maxHeight: 250 }}>
              {ivTab === "images" && (
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "12px 8px", fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>#</th>
                      <th style={{ padding: "12px 8px", fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>Image Repository</th>
                      <th style={{ padding: "12px 8px", fontWeight: 600, textTransform: "uppercase", fontSize: 11, textAlign: "right" }}>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.length === 0 ? <tr><td colSpan={3} style={{ padding: 40, color: "var(--text-muted)", textAlign: "center" }}>No images found</td></tr> :
                      images.slice(0, 15).map((img: any, i: number) => (
                        <tr key={i} className="row-hover" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: "12px 8px", color: "var(--text-primary)", fontWeight: 500 }}>{img.repository}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>:{img.tag}</span></td>
                          <td style={{ padding: "12px 8px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 600 }}>{img.size}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {ivTab === "volumes" && (
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "12px 8px", fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}>Volume Name</th>
                      <th style={{ padding: "12px 8px", fontWeight: 600, textTransform: "uppercase", fontSize: 11, textAlign: "right" }}>Estimated Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volumes.length === 0 ? <tr><td colSpan={2} style={{ padding: 40, color: "var(--text-muted)", textAlign: "center" }}>No volumes found</td></tr> :
                      volumes.slice(0, 15).map((vol: any, i: number) => (
                        <tr key={i} className="row-hover" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "12px 8px", color: "var(--text-primary)", fontWeight: 500 }}>{vol.name}</td>
                          <td style={{ padding: "12px 8px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 600 }}>{vol.usage_size}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
