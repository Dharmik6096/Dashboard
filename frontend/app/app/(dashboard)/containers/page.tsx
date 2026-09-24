"use client";
import { routes } from "@/lib/routes";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import api from "@/lib/api";
import type { Container, Server } from "@/types";
import { useFilter } from "@/lib/FilterContext";
import { formatBytes, formatLastSeen } from "@/lib/formatters";
import { Box, Search, RefreshCw, Server as ServerIcon, Play, AlertTriangle, RotateCw, HardDrive, Cpu, MemoryStick } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

function SortIcon({ col, sortCol, sortDir }: { col: keyof Container, sortCol: string, sortDir: string }) {
  if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4, display: "inline-block", fontSize: "0.85em" }}>↕</span>;
  return <span style={{ marginLeft: 4, display: "inline-block", fontSize: "0.85em", color: "var(--primary)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "16px 14px" }}>
          <div className="skeleton" style={{ height: 16, borderRadius: 6, width: i === 1 ? "85%" : i === 0 ? "100%" : "55%" }} />
        </td>
      ))}
    </tr>
  );
}

export default function ContainersPage() {
  const router = useRouter();
  const { envFilter, setEnvFilter, serverFilter, setServerFilter, environments, servers } = useFilter();
  const [containers, setContainers] = useState<Container[]>([]);
  const [serverCount, setServerCount] = useState(0);
  const [serversData, setServersData] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<keyof Container>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const initialLoad = useRef(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");
    if (initialLoad.current) setLoading(true);
    const params = new URLSearchParams();
    if (envFilter !== "all") params.append("env", envFilter);
    if (serverFilter !== "all") params.append("server_id", serverFilter);
    
    try {
      const [cRes, sRes] = await Promise.all([
        api.get(`/containers?${params.toString()}`),
        api.get(`/servers?${params.toString()}`)
      ]);
      setContainers(cRes.data);
      setServerCount(sRes.data.length);
      setServersData(sRes.data);
    } catch (err) {
      console.error(err);
      setError("Container inventory could not be loaded from the API.");
    } finally {
      setLoading(false);
      initialLoad.current = false;
      setRefreshing(false);
    }
  }, [envFilter, serverFilter]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000); // 15 seconds polling
    return () => clearInterval(iv);
  }, [load]);

  // Derived stats
  const stats = useMemo(() => {
    return {
      total: containers.length,
      running: containers.filter(c => c.status === "running").length,
      exited: containers.filter(c => c.status === "exited" || c.status === "dead").length,
      restarting: containers.filter(c => c.status === "restarting").length,
      unhealthy: containers.filter(c => c.health_status === "unhealthy").length,
    };
  }, [containers]);

  // Filter
  const statuses = ["all", "running", "exited", "restarting", "paused", "unhealthy"];

  const filtered = containers.filter(c => {
    if (statusFilter !== "all") {
      if (statusFilter === "unhealthy") {
        if (c.health_status?.toLowerCase() !== "unhealthy") return false;
      } else {
        if (c.status?.toLowerCase() !== statusFilter) return false;
      }
    }

    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) &&
        !c.image?.toLowerCase().includes(q) &&
        !c.server_name?.toLowerCase().includes(q) &&
        !c.container_id?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const aVal: any = a[sortCol];
    const bVal: any = b[sortCol];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  function toggleSort(col: keyof Container) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  
  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="page-title" style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <div style={{ padding: 8, background: "rgba(102,153,255,0.1)", borderRadius: 10, color: "var(--primary)", display: "flex" }}>
              <Box size={22} />
            </div>
            Containers
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.1 }}
            className="page-subtitle" style={{ marginTop: 6 }}
          >
            Observe {stats.total} containers across {serverCount} monitored servers. No runtime controls are enabled.
          </motion.p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { load(); }} className="btn" style={{ padding: "0 16px", height: 38, borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", cursor: "pointer", transition: "all 0.2s ease" }}>
            <RefreshCw size={16} className={refreshing ? "spin" : ""} style={{ marginRight: 8 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[
          { label: "Total Containers", val: stats.total, color: "var(--primary)", bg: "rgba(102,153,255,0.1)", Icon: Box },
          { label: "Running", val: stats.running, color: "#22c55e", bg: "rgba(34,197,94,0.1)", Icon: Play },
          { label: "Exited / Dead", val: stats.exited, color: "#ef4444", bg: "rgba(239,68,68,0.1)", Icon: HardDrive },
          { label: "Restarting", val: stats.restarting, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", Icon: RotateCw },
          { label: "Unhealthy", val: stats.unhealthy, color: "#ef4444", bg: "rgba(239,68,68,0.1)", Icon: AlertTriangle },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.05 }}
            key={stat.label} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <stat.Icon size={20} style={{ color: stat.color }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.val}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: "12px 16px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", border: "1px solid var(--border)", background: "var(--bg-primary)" }}>
        <div style={{ flex: 1, minWidth: 280, position: "relative" }}>
          <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search container name, image, server, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 40, height: 38, borderRadius: 8, fontSize: 14, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select style={{ height: 38, borderRadius: 8, fontSize: 14, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", outline: "none", padding: "0 10px", minWidth: 140 }} value={envFilter} onChange={e => setEnvFilter(e.target.value)}>
            <option value="all">All Environments</option>
            {environments.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select style={{ height: 38, borderRadius: 8, fontSize: 14, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", outline: "none", padding: "0 10px", minWidth: 140 }} value={serverFilter} onChange={e => setServerFilter(e.target.value)}>
            <option value="all">All Servers</option>
            {servers.filter(s => envFilter === "all" || (s.environment || "Production") === envFilter).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select style={{ height: 38, borderRadius: 8, fontSize: 14, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", outline: "none", padding: "0 10px", minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {statuses.map(s => (
              <option key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {serversData.some(s => s.docker_status === "PERMISSION DENIED" || s.docker_status === "NOT INSTALLED") && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} style={{ padding: 16, backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle size={20} style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Docker Unreachable on some servers</div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>One or more servers have Docker permission issues or Docker is not installed. Ensure the SSH user is added to the docker group.</div>
          </div>
        </motion.div>
      )}

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                <th onClick={() => toggleSort("name")} style={{ cursor: "pointer", padding: "16px 20px", width: "20%" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>CONTAINER <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} /></div>
                </th>
                <th onClick={() => toggleSort("server_name")} style={{ cursor: "pointer", width: "15%" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>SERVER <SortIcon col="server_name" sortCol={sortCol} sortDir={sortDir} /></div>
                </th>
                <th style={{ width: "15%" }}>IMAGE</th>
                <th onClick={() => toggleSort("status")} style={{ cursor: "pointer", width: "10%" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>STATUS <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} /></div>
                </th>
                <th style={{ width: "8%" }}>HEALTH</th>
                <th onClick={() => toggleSort("last_cpu_percent")} style={{ cursor: "pointer", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}><Cpu size={14} style={{ marginRight: 6, color: "var(--text-muted)" }}/> CPU <SortIcon col="last_cpu_percent" sortCol={sortCol} sortDir={sortDir} /></div>
                </th>
                <th onClick={() => toggleSort("last_mem_usage")} style={{ cursor: "pointer", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}><MemoryStick size={14} style={{ marginRight: 6, color: "var(--text-muted)" }}/> MEMORY <SortIcon col="last_mem_usage" sortCol={sortCol} sortDir={sortDir} /></div>
                </th>
                <th style={{ textAlign: "right" }}>PORTS</th>
                <th onClick={() => toggleSort("restart_count")} style={{ cursor: "pointer", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>RESTARTS <SortIcon col="restart_count" sortCol={sortCol} sortDir={sortDir} /></div>
                </th>
                <th style={{ textAlign: "right", paddingRight: 20 }}>UPTIME</th>
              </tr>
            </thead>
            {loading && containers.length === 0 ? (
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={10} />)}
              </tbody>
            ) : error ? (
              <tbody><tr><td colSpan={10} style={{ padding: 60, textAlign: "center", color: "var(--color-critical)" }}><AlertTriangle size={28} style={{ margin: "0 auto 10px" }} />{error}<br /><button type="button" onClick={load} className="btn btn-secondary" style={{ marginTop: 14 }}>Try again</button></td></tr></tbody>
            ) : sorted.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} style={{ padding: 60, textAlign: "center" }}>
                    <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Search size={32} style={{ color: "var(--text-muted)" }} />
                      </div>
                      <div className="empty-state-title" style={{ fontSize: 18, fontWeight: 600 }}>No containers found</div>
                      <div style={{ color: "var(--text-muted)", maxWidth: 300 }}>Try adjusting your search or filters to find what you're looking for.</div>
                      <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="btn-secondary" style={{ marginTop: 12 }}>Clear Filters</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <motion.tbody 
                key={refreshing ? 'refreshing' : 'idle'}
                variants={containerVariants} 
                initial="hidden" 
                animate="show"
                style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s ease" }}
              >
                {sorted.map((c) => {
                  const isRunning = c.status === "running";
                  const isExited = c.status === "exited" || c.status === "dead";
                  return (
                    <motion.tr 
                      variants={rowVariants}
                      key={c.id} 
                      className="clickable hover-3d" 
                      onClick={() => router.push(routes.container(c.id))}
                      style={{ 
                        transition: "all 0.2s ease", 
                        borderBottom: "1px solid var(--border)",
                        background: "var(--bg-primary)"
                      }}
                    >
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isRunning ? "#22c55e" : isExited ? "#ef4444" : "#f59e0b", flexShrink: 0, boxShadow: `0 0 8px ${isRunning ? 'rgba(34,197,94,0.4)' : isExited ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}` }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                              {c.container_id.substring(0, 12)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                          <ServerIcon size={14} style={{ opacity: 0.6 }} />
                          {c.server_name}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{c.image?.split(":")[0]}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>:{c.image?.split(":")[1] || "latest"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge`} style={{ 
                          background: isRunning ? "rgba(34,197,94,0.1)" : isExited ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                          color: isRunning ? "#22c55e" : isExited ? "#ef4444" : "#f59e0b",
                          border: `1px solid ${isRunning ? "rgba(34,197,94,0.2)" : isExited ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                          padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: 0.5
                        }}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {c.health_status && c.health_status !== "N/A" ? (
                          <span style={{ 
                            fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 12,
                            background: c.health_status === "healthy" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            color: c.health_status === "healthy" ? "#22c55e" : "#ef4444",
                            whiteSpace: "nowrap"
                          }}>
                            {c.health_status.charAt(0).toUpperCase() + c.health_status.slice(1)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: c.last_cpu_percent !== undefined && c.last_cpu_percent > 80 ? "#ef4444" : "var(--text-primary)" }}>
                          {c.last_cpu_percent != null ? `${c.last_cpu_percent.toFixed(1)}%` : "—"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-secondary)" }}>
                          {c.last_mem_usage !== null && c.last_mem_usage !== undefined ? formatBytes(c.last_mem_usage) : "—"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {c.ports ? (
                            typeof c.ports === 'string' ? (
                              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{c.ports}</div>
                            ) : Object.keys(c.ports).length > 0 ? (
                              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                                {Object.values(c.ports)[0]}
                                {Object.keys(c.ports).length > 1 && <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>+{Object.keys(c.ports).length - 1}</span>}
                              </div>
                            ) : "—"
                          ) : "—"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: c.restart_count > 0 ? "#f59e0b" : "var(--text-secondary)" }}>
                          {c.restart_count || 0}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", paddingRight: 20 }}>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          {formatLastSeen(c.created_at)}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            )}
          </table>
        </div>
        
        {/* Result summary */}
        {!loading && sorted.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Showing {sorted.length} of {containers.length} containers
            <div style={{ display: "flex", gap: 16 }}>
              <span>Auto-refreshing every 15s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
