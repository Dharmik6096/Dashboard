"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Server as ServerIcon, Play, RefreshCw,
  Search, ServerCrash, Cpu, MemoryStick, Activity, Moon, HardDrive,
  ChevronLeft, ChevronRight, Copy, CheckCircle, Info
} from "lucide-react";
import api from "@/lib/api";
import { formatLastSeen } from "@/lib/formatters";
import type { Process } from "@/types/processes";
import { EnvironmentSelect } from "@/components/ui/EnvironmentSelect";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type { Server } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return "Unavailable";
  const n = typeof bytes === "string" ? parseFloat(bytes) : bytes;
  if (isNaN(n)) return "Unavailable";
  if (n === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return parseFloat((n / Math.pow(1024, i)).toFixed(1)) + " " + sizes[i];
}

function formatUptime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "Unavailable";
  const s = typeof seconds === "string" ? parseFloat(seconds) : seconds;
  if (isNaN(s) || s === 0) return "Unavailable";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function stateBadge(state: string | null | undefined) {
  if (!state) return <span className="status-badge badge-offline">unknown</span>;
  switch (String(state)[0].toUpperCase()) {
    case 'R': return <span className="status-badge badge-online">running</span>;
    case 'S': return <span className="status-badge" style={{ backgroundColor: "rgba(102,153,255,0.15)", color: "#99bbff" }}>sleeping</span>;
    case 'D': return <span className="status-badge badge-critical">uninterruptible</span>;
    case 'Z': return <span className="status-badge badge-critical">zombie</span>;
    case 'T': return <span className="status-badge badge-warning">stopped</span>;
    case 'I': return <span className="status-badge badge-offline">idle</span>;
    default: return <span className="status-badge badge-offline">{state}</span>;
  }
}

function MiniBar({ value }: { value: number | null | undefined }) {
  if (value == null) return <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Unavailable</span>;
  const n = typeof value === "string" ? parseFloat(value as string) : value;
  if (isNaN(n)) return <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Unavailable</span>;
  const cls = n > 80 ? "bg-critical" : n > 60 ? "bg-warning" : "bg-primary";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", width: 42 }}>
        {n.toFixed(1)}%
      </span>
      <div className="metric-bar" style={{ width: 56 }}>
        <div className={`metric-bar-fill ${cls}`} style={{ width: `${Math.min(n, 100)}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination component
// ─────────────────────────────────────────────────────────────────────────────

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

  // Build page buttons: always show first, last, current ± 2, with ellipses
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
    minWidth: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 8px",
  };
  const PBactive: React.CSSProperties = { ...PB, background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" };
  const PBdis: React.CSSProperties = { ...PB, opacity: 0.4, cursor: "not-allowed" };

  return (
    <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Showing {start}–{end} of {totalItems.toLocaleString()} processes
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={page <= 1 ? PBdis : PB}>
          <ChevronLeft size={13} />
        </button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: 12 }}>…</span>
            : <button key={p} onClick={() => onPage(p as number)} style={page === p ? PBactive : PB}>{p}</button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={page >= totalPages ? PBdis : PB}>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

interface PaginationState {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

import { useFilter } from "@/lib/FilterContext";

export default function ProcessesPage() {
  const { envFilter, setEnvFilter, serverFilter, setServerFilter, environments } = useFilter();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [scope, setScope] = useState<"server" | "container">("server");
  const [containerFilter, setContainerFilter] = useState("All Containers");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState(""); // local input state for debounce
  const [interval, setIntervalTime] = useState("10s");

  // Sorting
  const [sortCol, setSortCol] = useState("cpu_percent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [pagination, setPagination] = useState<PaginationState | null>(null);

  const [summary, setSummary] = useState({
    total_processes: 0, high_cpu: 0, high_memory: 0,
    running: 0, sleeping: 0, selected_servers: 0, reporting_servers: 0
  });
  const [lastSampled, setLastSampled] = useState("");
  const [servers, setServers] = useState<Server[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounce search input → search state
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 300);
  };

  // Load server list
  useEffect(() => {
    api.get("/servers").then(res => setServers(Array.isArray(res.data) ? res.data : [])).catch(() => { });
    api.get("/containers").then(res => setContainers(Array.isArray(res.data) ? res.data : [])).catch(() => { });
  }, []);

  const load = useCallback(async (isAuto = false) => {
    if (!isAuto) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (envFilter && envFilter !== "All Environments" && envFilter !== "all" && envFilter !== "") params.append("environment", envFilter);
      if (serverFilter && serverFilter !== "All Servers" && serverFilter !== "all" && serverFilter !== "") params.append("server_id", serverFilter);
      params.append("scope", scope);
      if (containerFilter && containerFilter !== "All Containers" && containerFilter !== "all" && containerFilter !== "") params.append("container_id", containerFilter);
      if (search) params.append("search", search);
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      params.append("sort", sortCol);
      params.append("order", sortDir);

      const res = await api.get(`/processes?${params.toString()}`);
      const data = res.data;

      setProcesses(Array.isArray(data?.processes) ? data.processes : []);
      if (data?.summary) setSummary(data.summary);
      if (data?.sampled_at) setLastSampled(data.sampled_at);
      if (data?.pagination) setPagination(data.pagination);

      // Preserve selected process
      setSelectedProcess(prev => {
        if (!prev) return null;
        const still = (data?.processes || []).find(
          (p: Process) => p.pid === prev.pid && p.server_id === prev.server_id
        );
        return still || null;
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load processes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [envFilter, serverFilter, scope, containerFilter, search, page, pageSize, sortCol, sortDir]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh — stay on current page
  useEffect(() => {
    if (interval === "off") return;
    const ms = interval === "10s" ? 10000 : interval === "30s" ? 30000 : 60000;
    const t = setInterval(() => load(true), ms);
    return () => clearInterval(t);
  }, [interval, load]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleScopeChange = (v: "server" | "container") => { setScope(v); setPage(1); };
  const handleContainerChange = (v: string) => { setContainerFilter(v); setPage(1); };

  const { total_processes: total, high_cpu: highCpu, high_memory: highMem, running, sleeping, reporting_servers, selected_servers } = summary;

  const topCpu = [...processes].sort((a, b) => (b.cpu_percent || 0) - (a.cpu_percent || 0)).slice(0, 5);
  const topMem = [...processes].sort((a, b) => (b.memory_percent || 0) - (a.memory_percent || 0)).slice(0, 5);

  const copyCommand = () => {
    if (selectedProcess?.command) {
      navigator.clipboard.writeText(selectedProcess.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  function SortTh({ col, label }: { col: string; label: string }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => handleSort(col)}
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      >
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", height: "100%", gap: 20 }}>

      {/* HEADER */}
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="page-title">
            <Activity size={24} style={{ color: "var(--primary)" }} /> Processes
          </div>
          <div className="page-subtitle">Read-only live process visibility across servers and containers</div>
        </div>
      </div>

      {/* ── FILTER BAR — responsive wrapping ── */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>


          {/* Server | Container toggle */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: 6, padding: 3, flexShrink: 0 }}>
            {(["server", "container"] as const).map(s => (
              <button
                key={s}
                onClick={() => handleScopeChange(s)}
                style={{
                  padding: "4px 10px", fontSize: 12, fontWeight: 600, borderRadius: 4,
                  border: "none", cursor: "pointer",
                  background: scope === s ? "var(--bg-elevated)" : "transparent",
                  color: scope === s ? "var(--text-primary)" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                }}
              >
                {s === "server" ? <ServerIcon size={13} /> : <HardDrive size={13} />}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Environment selector */}
          <select
            style={{
              width: 130, fontSize: 12, padding: "5px 8px", flexShrink: 0,
              background: "var(--bg-input)", color: "var(--text-primary)", 
              border: "1px solid var(--border)", borderRadius: 6, outline: "none"
            }}
            value={envFilter}
            onChange={e => setEnvFilter(e.target.value)}
          >
            <option value="all">All Environments</option>
            {environments.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {/* Server selector */}
          <select
            style={{
              width: 130, fontSize: 12, padding: "5px 8px", flexShrink: 0,
              background: "var(--bg-input)", color: "var(--text-primary)", 
              border: "1px solid var(--border)", borderRadius: 6, outline: "none"
            }}
            value={serverFilter}
            onChange={e => setServerFilter(e.target.value)}
          >
            <option value="all">All Servers</option>
            {servers.filter(s => envFilter === "all" || (s.environment || "Production") === envFilter).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Container selector */}
          <select
            style={{
              width: 140, fontSize: 12, padding: "5px 8px", flexShrink: 0,
              opacity: scope === "server" ? 0.45 : 1,
              background: "var(--bg-input)", color: "var(--text-primary)", 
              border: "1px solid var(--border)", borderRadius: 6, outline: "none"
            }}
            disabled={scope === "server"}
            value={containerFilter}
            onChange={e => handleContainerChange(e.target.value)}
          >
            <option value="All Containers">All Containers</option>
            {containers
              .filter(c => serverFilter === "all" || c.server_id === serverFilter)
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
            ))}
          </select>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 160, margin: 0, display: "flex", alignItems: "center" }}>
            <Search size={13} style={{ position: "absolute", left: 9, color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search PID, user, process..."
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              style={{ 
                padding: "5px 10px 5px 28px", fontSize: 12, width: "100%", height: 30,
                background: "var(--bg-input)", color: "var(--text-primary)", 
                border: "1px solid var(--border)", borderRadius: 6, outline: "none"
              }}
            />
          </div>

          {/* Live badge */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>LIVE</span>
          </div>

          {/* Interval */}
          <select style={{ width: 64, padding: "4px 6px", fontSize: 12, flexShrink: 0, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 6, outline: "none" }} value={interval} onChange={e => setIntervalTime(e.target.value)}>
            <option value="10s">10s</option>
            <option value="30s">30s</option>
            <option value="1m">1m</option>
            <option value="off">Off</option>
          </select>

          {/* Refresh */}
          <button className="btn-primary" onClick={() => load(false)} style={{ padding: "0 12px", height: 30, fontSize: 12, flexShrink: 0 }}>
            <RefreshCw size={13} className={refreshing ? "spin" : ""} style={{ marginRight: 5 }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS — responsive grid ── */}
      <div className="metric-grid" style={{ gap: 16 }}>
        {[
          { label: "Total Processes", val: total, sub: "Processes observed", color: "var(--primary)", bg: "rgba(102,153,255,0.1)", Icon: ServerIcon },
          { label: "High CPU", val: highCpu, sub: "> 10% CPU usage", color: "#ef4444", bg: "rgba(239,68,68,0.1)", Icon: Cpu },
          { label: "High Memory", val: highMem, sub: "> 5% memory", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", Icon: MemoryStick },
          { label: "Running", val: running, sub: "Active processes", color: "#22c55e", bg: "rgba(34,197,94,0.1)", Icon: Play },
          { label: "Sleeping", val: sleeping, sub: "Sleeping processes", color: "#6699ff", bg: "rgba(102,153,255,0.1)", Icon: Moon },
          {
            label: serverFilter === "All Servers" ? "Reporting" : "Server",
            val: serverFilter === "All Servers" ? `${reporting_servers}/${selected_servers}` : (servers.find(s => s.id === serverFilter)?.name || "—"),
            sub: serverFilter === "All Servers" ? "Servers live" : "Selected server",
            color: "var(--text-primary)", bg: "rgba(255,255,255,0.07)", Icon: ServerIcon,
          },
        ].map(({ label, val, sub, color, bg, Icon }) => (
          <div key={label} className="card hover-card" style={{ padding: "16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "2px", background: `linear-gradient(90deg, ${color}, transparent)` }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PROCESS TABLE ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Processes</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {search ? `${total.toLocaleString()} matches` : `${total.toLocaleString()} total`}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Updated {formatLastSeen(lastSampled) || "just now"}
          </div>
        </div>

        {/* Table body — no vertical scroll, pagination handles scale */}
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--bg-primary)" }}>
              <tr>
                <SortTh col="pid" label="PID" />
                <SortTh col="user" label="USER" />
                <SortTh col="name" label="PROCESS" />
                <th>COMMAND</th>
                <SortTh col="cpu_percent" label="CPU %" />
                <SortTh col="memory_percent" label="MEM %" />
                <SortTh col="rss_bytes" label="RSS" />
                <SortTh col="state" label="STATE" />
                <SortTh col="elapsed_seconds" label="UPTIME" />
                <SortTh col="server_name" label="SERVER" />
                <SortTh col="container_name" label="CONTAINER" />
                <SortTh col="sampled_at" label="LAST SEEN" />
              </tr>
            </thead>
            <tbody>
              {loading && processes.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 13, width: j === 3 ? "80%" : "55%", borderRadius: 3 }} /></td>
                    ))}
                  </tr>
                ))
                : error
                  ? <tr><td colSpan={12} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    <ServerCrash size={28} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                    {error}
                  </td></tr>
                  : processes.length === 0
                    ? <tr><td colSpan={12} style={{ textAlign: "center", padding: 36, color: "var(--text-muted)" }}>No processes found.</td></tr>
                    : processes.map(p => (
                      <tr
                        key={`${p.server_id}-${p.pid}`}
                        style={{
                          cursor: "pointer",
                          background: selectedProcess?.pid === p.pid && selectedProcess?.server_id === p.server_id ? "rgba(102,153,255,0.08)" : undefined,
                          borderLeft: selectedProcess?.pid === p.pid && selectedProcess?.server_id === p.server_id ? "2px solid var(--primary)" : "2px solid transparent",
                        }}
                        onClick={() => setSelectedProcess(p)}
                      >
                        <td style={{ color: "var(--text-muted)" }}>{p.pid}</td>
                        <td>{p.user || <span style={{color: "var(--text-muted)", fontStyle: "italic"}}>Permission limited</span>}</td>
                        <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{p.name || "Unavailable"}</td>
                        <td style={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                          {p.command || <span style={{color: "var(--text-muted)", fontStyle: "italic"}}>Permission limited</span>}
                        </td>
                        <td><MiniBar value={p.cpu_percent} /></td>
                        <td><MiniBar value={p.memory_percent} /></td>
                        <td style={{ fontWeight: 500 }}>{formatBytes(p.rss_bytes)}</td>
                        <td>{stateBadge(p.state)}</td>
                        <td>{formatUptime(p.elapsed_seconds)}</td>
                        <td style={{ color: "var(--primary)", fontSize: 12, fontWeight: 500 }}>{p.server_name}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{p.container_name || "—"}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatLastSeen(p.sampled_at)}</td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.total_pages}
            totalItems={pagination.total_items}
            pageSize={pagination.page_size}
            onPage={p => setPage(p)}
          />
        )}
      </div>

      {/* ── BOTTOM PANELS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Top CPU */}
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Cpu size={15} style={{ color: "#ef4444" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Top CPU Processes</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Top 5 by CPU usage (this page)</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topCpu.length === 0
              ? <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No data</div>
              : topCpu.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSelectedProcess(p)}>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({p.pid})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, width: 90, flexShrink: 0 }}>
                    <div className="metric-bar" style={{ flex: 1 }}>
                      <div className="metric-bar-fill" style={{ width: `${Math.min(p.cpu_percent || 0, 100)}%`, background: (p.cpu_percent || 0) > 10 ? "#ef4444" : "var(--primary)" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: (p.cpu_percent || 0) > 10 ? "#ef4444" : "var(--text-primary)", width: 36, textAlign: "right" }}>
                      {(p.cpu_percent || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Top Memory */}
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MemoryStick size={15} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Top Memory Processes</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Top 5 by memory (this page)</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topMem.length === 0
              ? <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No data</div>
              : topMem.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSelectedProcess(p)}>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({p.pid})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, width: 90, flexShrink: 0 }}>
                    <div className="metric-bar" style={{ flex: 1 }}>
                      <div className="metric-bar-fill" style={{ width: `${Math.min(p.memory_percent || 0, 100)}%`, background: (p.memory_percent || 0) > 5 ? "#f59e0b" : "var(--primary)" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: (p.memory_percent || 0) > 5 ? "#f59e0b" : "var(--text-primary)", width: 36, textAlign: "right" }}>
                      {(p.memory_percent || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Process Details */}
        <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Activity size={15} style={{ color: "var(--text-primary)" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Process Details</div>
            </div>
            {selectedProcess && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "3px 8px", borderRadius: 4 }}>
                PID {selectedProcess.pid}
              </div>
            )}
          </div>

          {selectedProcess ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 14 }}>
                {[
                  ["PID", selectedProcess.pid],
                  ["Server", selectedProcess.server_name],
                  ["Parent PID", selectedProcess.ppid],
                  ["Container", selectedProcess.container_name || "—"],
                  ["User", selectedProcess.user],
                  ["Uptime", formatUptime(selectedProcess.elapsed_seconds)],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{k}:</span>{" "}
                    <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, float: "right" }}>{v as string}</span>
                  </div>
                ))}
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>State:</span>
                  <span style={{ float: "right" }}>{stateBadge(selectedProcess.state)}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Threads:</span>
                  <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, float: "right" }}>{selectedProcess.threads ?? "—"}</span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Command Line</div>
              <div style={{
                background: "var(--bg-secondary)", borderRadius: 6, padding: "10px 12px",
                fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)",
                wordBreak: "break-all", border: "1px solid var(--border)", position: "relative",
                maxHeight: 80, overflowY: "auto",
              }}>
                {selectedProcess.command}
                <button onClick={copyCommand} style={{
                  position: "absolute", top: 6, right: 6, background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", borderRadius: 4, width: 22, height: 22,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  color: copied ? "#22c55e" : "var(--text-muted)",
                }}>
                  {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", opacity: 0.5 }}>
              <Activity size={28} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13 }}>Select a process to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
