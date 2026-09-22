"use client";
import { routes } from "@/lib/routes";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { Server } from "@/types";
import {
  formatPercent, formatLastSeen, metricColor, barClass, safeValue, capitalize
} from "@/lib/formatters";
import {
  Plus, Server as ServerIcon, RefreshCw, Search, MoreVertical, Trash2, Settings,
  CheckCircle, AlertTriangle, XCircle, Info, Layers, ChevronDown, Activity, ArrowRight, ServerCrash
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PortalPopover } from "@/components/ui/PortalPopover";
import { useFilter } from "@/lib/FilterContext";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ServerDetailsCentered } from "./ServerDetailsCentered";

const STATUS_ORDER = ["online", "warning", "critical", "offline", "unknown"];
const ENV_BADGE: Record<string, string> = {
  production: "badge-production",
  database: "badge-database",
  staging: "badge-staging",
  development: "badge-development",
  qa: "badge-qa",
};

const STATUS_BADGE: Record<string, string> = {
  online: "badge-online",
  warning: "badge-warning",
  critical: "badge-critical",
  offline: "badge-offline",
  unknown: "badge-offline",
};

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 11 }).map((_, i) => (
        <td key={i} style={{ padding: "12px 14px" }}>
          <div className="skeleton" style={{ height: 14, width: i === 0 ? "80%" : "60%", borderRadius: 4 }} />
        </td>
      ))}
    </tr>
  );
}

function MiniBar({ value, criticalThreshold = 90 }: { value: number | null, criticalThreshold?: number }) {
  if (value === null) return (
    <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Unavailable</span>
  );
  const isCritical = value >= criticalThreshold;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 70 }}>
      <span style={{ color: isCritical ? "var(--color-critical)" : "var(--text-primary)", fontWeight: isCritical ? 700 : 600, fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {value.toFixed(0)}%
      </span>
      <div style={{ height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: isCritical ? "var(--color-critical)" : metricColor(value), borderRadius: 2 }} />
      </div>
    </div>
  );
}

function MetricCard({
  label, value, icon: Icon, color, sub, subColor
}: {
  label: string; value: React.ReactNode; icon: React.ElementType; color: string; sub?: string; subColor?: string;
}) {
  return (
    <div className="metric-card hover-3d" style={{ '--color-blue': color, padding: "16px 20px" } as React.CSSProperties}>
      <div className="metric-card-label" style={{ fontSize: 13 }}>
        <Icon size={16} style={{ color: "var(--text-muted)" }} />
        <span>{label}</span>
      </div>
      <div className="metric-card-value" style={{ fontSize: 32, marginTop: 8 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: "auto", fontSize: 13, color: subColor || "var(--text-muted)", fontWeight: 600, paddingTop: 12 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function ServersPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortCol, setSortCol] = useState<"name" | "cpu" | "ram" | "disk" | "status" | "last_seen">("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [removeDialogServer, setRemoveDialogServer] = useState<Server | null>(null);
  const [testDialogServer, setTestDialogServer] = useState<Server | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Global Context
  const { envFilter, setEnvFilter, environments } = useFilter();
  const [envDropOpen, setEnvDropOpen] = useState(false);
  const envDropRef = useRef<HTMLDivElement>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  // Drill-down pane
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedServerId) {
        setSelectedServerId(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedServerId]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (envDropRef.current && !envDropRef.current.contains(e.target as Node)) setEnvDropOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleRemove = async () => {
    if (!removeDialogServer) return;
    try {
      await api.delete(`/servers/${removeDialogServer.id}`);
      setRemoveDialogServer(null);
      if (selectedServerId === removeDialogServer.id) setSelectedServerId(null);
      load(true);
    } catch {
      alert("Failed to remove server.");
    }
  };

  const handleTestConnection = async (server: Server) => {
    setTestDialogServer(server);
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.post(`/servers/${server.id}/test`);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ ssh: { status: "error", reason: err.response?.data?.detail || "Failed to test connection.", step: "Network/SSH" } });
    } finally {
      setIsTesting(false);
    }
  };

  const load = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (envFilter && envFilter !== "all" && envFilter !== "All Environments") {
        params.append("env", envFilter);
      }
      const res = await api.get(`/servers?${params.toString()}`);
      setServers(res.data);
      if (manual) {
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Failed to load servers", err);
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
    }
  }, [envFilter]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(() => load(false), 15000);
    return () => clearInterval(iv);
  }, [load]);

  const statuses = ["all", "online", "warning", "critical", "offline"];

  // Sort + filter
  const sorted = useMemo(() => {
    return [...servers]
      .filter(s => {
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return s.name.toLowerCase().includes(q)
            || s.ip_address.includes(q)
            || (s.hostname || "").toLowerCase().includes(q)
            || (s.environment || "").toLowerCase().includes(q)
            || (s.tags || []).some(t => t.toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => {
        let av: any = 0, bv: any = 0;
        if (sortCol === "name") {
          return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        if (sortCol === "status") {
          av = STATUS_ORDER.indexOf(a.status);
          bv = STATUS_ORDER.indexOf(b.status);
        } else if (sortCol === "cpu") { av = a.last_cpu_percent ?? -1; bv = b.last_cpu_percent ?? -1; }
        else if (sortCol === "ram") { av = a.last_ram_percent ?? -1; bv = b.last_ram_percent ?? -1; }
        else if (sortCol === "disk") { av = a.last_disk_percent ?? -1; bv = b.last_disk_percent ?? -1; }
        else if (sortCol === "last_seen") {
          av = a.last_seen ? new Date(a.last_seen).getTime() : 0;
          bv = b.last_seen ? new Date(b.last_seen).getTime() : 0;
        }
        return sortDir === "asc" ? av - bv : bv - av;
      });
  }, [servers, statusFilter, search, sortCol, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const currentData = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const renderSortIcon = (col: typeof sortCol) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const onlineCount = servers.filter(s => s.status === "online").length;
  const warningCount = servers.filter(s => s.status === "warning").length;
  const criticalCount = servers.filter(s => s.status === "critical").length;
  const offlineCount = servers.filter(s => s.status === "offline").length;

  const selectedServer = servers.find(s => s.id === selectedServerId);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", position: "relative" }}>
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="noc-toolbar noc-toolbar-entrance">
        <div className="noc-toolbar-group" style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ServerIcon size={18} color="var(--text-primary)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Servers Inventory</span>
          </div>
        </div>

        <div className="noc-toolbar-divider" />

        {/* ── Environment Dropdown ── */}
        <div ref={envDropRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setEnvDropOpen(o => !o)}
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
                  onClick={() => { setEnvFilter(env); setEnvDropOpen(false); setPage(1); }}
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

        <div className="noc-toolbar-divider" />

        <div className="search-bar" style={{ maxWidth: 280, flex: "none", height: 32 }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            className="search-input"
            placeholder="Search servers, IPs, tags…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="noc-toolbar-divider" style={{ marginLeft: "auto" }} />

        <div className="noc-toolbar-group" style={{ flexShrink: 0 }}>
          <button className={`btn-refresh ${isRefreshing ? "refreshing" : ""} ${refreshSuccess ? "success" : ""}`} onClick={() => load(true)} disabled={isRefreshing} title="Refresh now">
            <RefreshCw size={14} className={isRefreshing ? "spin" : ""} style={{ transition: "transform 0.5s ease" }} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          
          <Link href={routes.addServer} className="btn btn-primary" style={{ height: 32, padding: "0 12px" }}>
            <Plus size={14} /> Add Server
          </Link>
        </div>
      </div>

      {/* ── Metrics Summary ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <MetricCard
          label="Total Monitored" icon={ServerIcon} color="var(--color-blue)"
          value={<AnimatedNumber value={servers.length} />}
          sub={envFilter !== "all" ? `In ${envFilter} environment` : "Across all environments"}
        />
        <MetricCard
          label="Healthy & Online" icon={CheckCircle} color="var(--color-healthy)"
          value={<AnimatedNumber value={onlineCount} />}
        />
        <MetricCard
          label="Warning State" icon={AlertTriangle} color="var(--color-warning)"
          value={<AnimatedNumber value={warningCount} />}
          sub={warningCount > 0 ? "Requires review" : "No warnings"}
          subColor={warningCount > 0 ? "var(--color-warning)" : undefined}
        />
        <MetricCard
          label="Critical / Offline" icon={ServerCrash} color="var(--color-critical)"
          value={<AnimatedNumber value={criticalCount + offlineCount} />}
          sub={`${criticalCount} critical, ${offlineCount} offline`}
          subColor={(criticalCount + offlineCount) > 0 ? "var(--color-critical)" : undefined}
        />
      </div>

      {/* ── Table & Details Layout ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, position: "relative" }}>
        
        {/* Main Table Area */}
        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", transition: "all 0.3s ease", opacity: selectedServer ? 0.4 : 1, filter: selectedServer ? "blur(2px)" : "none", pointerEvents: selectedServer ? "none" : "auto" }}>
          
          {/* Internal filter bar for status */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 8, background: "var(--bg-panel)" }}>
            {statuses.map(s => (
              <button key={s} className={`filter-chip ${statusFilter === s ? "active" : ""}`}
                onClick={() => { setStatusFilter(s); setPage(1); }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {s !== "all" && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: s === "online" ? "var(--color-healthy)" : s === "warning" ? "var(--color-warning)" : s === "critical" ? "var(--color-critical)" : "var(--color-offline)" }} />
                )}
                {s === "all" ? "All Statuses" : capitalize(s)}
                <span style={{ marginLeft: 4, fontWeight: 700, color: statusFilter === s ? "inherit" : "var(--text-muted)" }}>
                  {s === "all" ? servers.length : servers.filter(srv => srv.status === s).length}
                </span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <table className="data-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-panel)", boxShadow: "0 1px 0 var(--border-subtle)" }}>
                <tr>
                  <th onClick={() => toggleSort("name")} style={{ cursor: "pointer", paddingLeft: 20 }}>
                    SERVER {renderSortIcon("name")}
                  </th>
                  <th>ENV</th>
                  <th>IP / HOST</th>
                  <th onClick={() => toggleSort("status")} style={{ cursor: "pointer" }}>
                    STATUS {renderSortIcon("status")}
                  </th>
                  <th onClick={() => toggleSort("cpu")} style={{ cursor: "pointer" }}>
                    CPU {renderSortIcon("cpu")}
                  </th>
                  <th onClick={() => toggleSort("ram")} style={{ cursor: "pointer" }}>
                    RAM {renderSortIcon("ram")}
                  </th>
                  <th onClick={() => toggleSort("disk")} style={{ cursor: "pointer" }}>
                    DISK {renderSortIcon("disk")}
                  </th>
                  <th>LOAD</th>
                  <th>APP/DB</th>
                  <th onClick={() => toggleSort("last_seen")} style={{ cursor: "pointer" }}>
                    LAST SEEN {renderSortIcon("last_seen")}
                  </th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: "60px 20px", textAlign: "center", border: "none" }}>
                      <ServerIcon size={32} style={{ color: "var(--text-muted)", marginBottom: 16, opacity: 0.5 }} />
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>No servers found</h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
                        Adjust your search or filters to find what you're looking for.
                      </p>
                      {(search || statusFilter !== "all" || envFilter !== "all") && (
                        <button className="btn btn-ghost" onClick={() => { setSearch(""); setStatusFilter("all"); setEnvFilter("all"); }}>
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  currentData.map(s => {
                    const cpu = safeValue(s.last_cpu_percent, null);
                    const ram = safeValue(s.last_ram_percent, null);
                    const disk = safeValue(s.last_disk_percent, null);
                    const statusBadge = STATUS_BADGE[s.status] ?? "badge-offline";
                    const envBadge = s.environment ? ENV_BADGE[s.environment.toLowerCase()] ?? "badge-info" : "badge-info";
                    const isSelected = selectedServerId === s.id;
                    const isStale = s.status === "offline" || (s as any).is_stale;

                    return (
                      <tr
                        key={s.id}
                        className={`clickable ${isSelected ? "row-selected" : ""} ${s.status === "critical" ? "row-alert" : s.status === "warning" ? "row-warn" : ""}`}
                        onClick={() => setSelectedServerId(isSelected ? null : s.id)}
                        style={{ 
                          transition: "all 0.15s ease",
                          background: isSelected ? "var(--bg-active)" : undefined,
                          boxShadow: isSelected ? "inset 3px 0 0 var(--color-blue)" : "none"
                        }}
                      >
                        <td style={{ paddingLeft: 20 }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            {s.name}
                            {(s.alert_count ?? 0) > 0 && (
                              <span style={{ fontSize: 10, background: "var(--color-critical)", color: "#000", padding: "1px 5px", borderRadius: 10, fontWeight: 800 }}>
                                {s.alert_count ?? 0} ALERTS
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                            {s.uptime_seconds ? `Up ${Math.floor(s.uptime_seconds / 86400)}d ${Math.floor((s.uptime_seconds % 86400) / 3600)}h` : "Uptime unknown"}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${envBadge}`}>{s.environment || "—"}</span>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>
                          {s.ip_address}
                          {s.ssh_port !== 22 && <span style={{ color: "var(--text-muted)" }}>:{s.ssh_port}</span>}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: s.status === "online" ? "var(--color-healthy)" : s.status === "warning" ? "var(--color-warning)" : s.status === "offline" ? "var(--text-muted)" : "var(--color-critical)", fontWeight: 600, fontSize: 12 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", boxShadow: `0 0 8px currentColor` }} />
                            {capitalize(s.status)}
                          </div>
                        </td>
                        <td><MiniBar value={cpu} criticalThreshold={90} /></td>
                        <td><MiniBar value={ram} criticalThreshold={90} /></td>
                        <td><MiniBar value={disk} criticalThreshold={90} /></td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>
                          {s.load_avg != null ? s.load_avg.toFixed(2) : "—"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>
                          {s.container_count != null ? `${s.container_count} cnts` : "—"}
                        </td>
                        <td style={{ fontSize: 13, color: isStale ? "var(--color-critical)" : "var(--text-muted)" }}>
                          {isStale && <span style={{ fontWeight: 700, marginRight: 6 }}>STALE</span>}
                          {s.last_seen ? formatLastSeen(s.last_seen) : "Never"}
                        </td>
                        <td style={{ position: "relative", textAlign: "right", paddingRight: 12 }} onClick={e => e.stopPropagation()}>
                          <button
                            id={`action-btn-${s.id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 4 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === s.id ? null : s.id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          <PortalPopover
                            isOpen={actionMenuOpen === s.id}
                            onClose={() => setActionMenuOpen(null)}
                            anchorEl={document.getElementById(`action-btn-${s.id}`)}
                            width={210}
                            offsetX={-190}
                            offsetY={4}
                          >
                            <div
                              className="dropdown-item"
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", color: "var(--text-primary)", fontSize: 13, borderRadius: 4, cursor: "pointer" }}
                              onClick={() => { setActionMenuOpen(null); setSelectedServerId(s.id); }}
                            >
                              <ServerIcon size={14} /> View Details
                            </div>
                            <div
                              className="dropdown-item"
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", color: "var(--text-primary)", fontSize: 13, borderRadius: 4, cursor: "pointer" }}
                              onClick={() => router.push(routes.editServer(s.id))}
                            >
                              <Settings size={14} /> Edit Monitoring Entry
                            </div>
                            <button
                              className="dropdown-item"
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", color: "var(--text-primary)", background: "transparent", border: "none", width: "100%", textAlign: "left", fontSize: 13, cursor: "pointer", borderRadius: 4 }}
                              onClick={() => { setActionMenuOpen(null); handleTestConnection(s); }}
                            >
                              <RefreshCw size={14} /> Test Connection
                            </button>

                            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

                            <button
                              className="dropdown-item"
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", color: "var(--color-critical)", background: "transparent", border: "none", width: "100%", textAlign: "left", fontSize: 13, cursor: "pointer", borderRadius: 4 }}
                              onClick={() => { setActionMenuOpen(null); setRemoveDialogServer(s); }}
                            >
                              <Trash2 size={14} /> Remove from Monitoring
                            </button>
                          </PortalPopover>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && sorted.length > 0 && (
            <div style={{ 
              display: "flex", alignItems: "center", justifyContent: "space-between", 
              padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-panel)",
              fontSize: 13, color: "var(--text-muted)"
            }}>
              <div>
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sorted.length)} of {sorted.length} servers
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  className="btn btn-ghost btn-sm" 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  disabled={page >= totalPages} 
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Drill-down Details Modal Overlay */}
      {selectedServer && (
        <div 
          className="server-modal-overlay fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedServerId(null);
          }}
        >
          <ServerDetailsCentered 
             server={selectedServer} 
             onClose={() => setSelectedServerId(null)} 
             router={router} 
          />
        </div>
      )}

      {/* Remove Dialog */}
      {removeDialogServer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 440, padding: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Remove {removeDialogServer.name} from monitoring?</h3>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
              This removes only the dashboard registration.<br /><br />
              <strong style={{ color: "var(--text-primary)" }}>No application, service, container or file on {removeDialogServer.name} will be changed.</strong>
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setRemoveDialogServer(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--color-critical)", border: "none" }} onClick={handleRemove}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Test Connection Dialog */}
      {testDialogServer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ width: 440, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Connection Test</h3>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setTestDialogServer(null)}><XCircle size={16} /></button>
            </div>

            {isTesting ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0" }}>
                <RefreshCw size={24} className="spin" style={{ color: "var(--color-primary)", marginBottom: 12 }} />
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Testing connection to {testDialogServer.name}...</p>
              </div>
            ) : testResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Network / SSH Reachability</span>
                    <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Network/SSH" ? "var(--color-critical)" : "var(--color-healthy)", fontWeight: 600 }}>
                      {testResult.ssh?.status === "error" && testResult.ssh?.step === "Network/SSH" ? "FAIL" : "PASS"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Authentication</span>
                    <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Authentication" ? "var(--color-critical)" : (testResult.ssh?.status === "error" && testResult.ssh?.step == "Network/SSH" ? "SKIP" : "PASS"), fontWeight: 600 }}>
                      {testResult.ssh?.status === "error" && testResult.ssh?.step === "Authentication" ? "FAIL" : (testResult.ssh?.status === "error" && testResult.ssh?.step == "Network/SSH" ? "SKIP" : "PASS")}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Linux System Check</span>
                    <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Linux OS Check" ? "var(--color-critical)" : (testResult.ssh?.status === "success" ? "PASS" : "SKIP"), fontWeight: 600 }}>
                      {testResult.ssh?.status === "error" && testResult.ssh?.step === "Linux OS Check" ? "FAIL" : (testResult.ssh?.status === "success" ? "PASS" : "SKIP")}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Metrics & Docker Discovery</span>
                    <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Metrics Collection" ? "var(--color-critical)" : (testResult.ssh?.status === "success" ? (testResult.ssh?.docker_available ? "PASS" : "LIMITED") : "SKIP"), fontWeight: 600 }}>
                      {testResult.ssh?.status === "error" && testResult.ssh?.step === "Metrics Collection" ? "FAIL" : (testResult.ssh?.status === "success" ? (testResult.ssh?.docker_available ? "PASS" : "LIMITED") : "SKIP")}
                    </span>
                  </div>
                </div>

                {testResult.ssh?.status === "success" ? (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 4 }}>
                      <span style={{ color: "var(--text-muted)" }}>Hostname:</span><span>{testResult.ssh.hostname}</span>
                      <span style={{ color: "var(--text-muted)" }}>OS:</span><span>{testResult.ssh.os}</span>
                      <span style={{ color: "var(--text-muted)" }}>CPU Cores:</span><span>{testResult.ssh.cpu_cores}</span>
                      <span style={{ color: "var(--text-muted)" }}>RAM:</span><span>{((testResult.ssh.ram_total || 0) / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                      <span style={{ color: "var(--text-muted)" }}>Docker:</span><span>{testResult.ssh.docker_available ? "Detected" : "Not Detected"}</span>
                    </div>
                  </div>
                ) : testResult.ssh?.status === "error" ? (
                  <div style={{ fontSize: 13, color: "var(--color-critical)", paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                    <XCircle size={16} />
                    <span>{testResult.ssh.reason}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .glass-card {
          background: rgba(20, 24, 30, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          border-radius: 12px;
        }
        .centered-details::-webkit-scrollbar {
          width: 6px;
        }
        .centered-details::-webkit-scrollbar-track {
          background: transparent;
        }
        .centered-details::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .centered-details::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
