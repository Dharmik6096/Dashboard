"use client";
import { routes } from "@/lib/routes";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import type { Container, ContainerEvent } from "@/types";
import { formatBytes, formatLastSeen } from "@/lib/formatters";
import { TimeSeriesChart } from "@/components/ui/charts";
import { LogViewer } from "@/components/ui";
import {
  Box, Activity, RefreshCw, Settings, ShieldAlert,
  RotateCcw, Network, Terminal, Info, ChevronLeft, Cpu, MemoryStick, Search, ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "overview" | "metrics" | "processes" | "logs" | "inspect" | "events";

export default function ContainerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [container, setContainer] = useState<Container | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [logs, setLogs] = useState<{ timestamp: string; level: string; message: string; raw: string }[]>([]);
  const [inspect, setInspect] = useState<Record<string, unknown>>({});
  const [events, setEvents] = useState<ContainerEvent[]>([]);
  const [processSearch, setProcessSearch] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [period, setPeriod] = useState("1h");

  const loadBase = useCallback(async () => {
    try {
      const { data } = await api.get(`/containers/${id}`);
      setContainer(data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMetrics = useCallback(async () => {
    try {
      const { data } = await api.get(`/containers/${id}/metrics/history?period=${period}`);
      setMetrics(data.map((m: Record<string, string | number>) => ({
        ...m,
        time: new Date(String(m.time)).toLocaleTimeString()
      })) as any);
    } catch {}
  }, [id, period]);

  const loadTab = useCallback(async () => {
    setTabLoading(true);
    try {
      if (activeTab === "processes") {
        const { data } = await api.get(`/containers/${id}/processes`);
        setProcesses(data.processes || []);
      } else if (activeTab === "logs") {
        const { data } = await api.get(`/containers/${id}/logs?tail=200`);
        const rawLogs = typeof data.logs === "string" ? data.logs : (Array.isArray(data.logs) ? data.logs.join("\n") : "");
        const parsed = rawLogs.split("\n").filter(Boolean).map((l: string) => ({
          timestamp: "", level: "info", message: l, raw: l
        }));
        setLogs(parsed);
      } else if (activeTab === "inspect") {
        const { data } = await api.get(`/containers/${id}/inspect`);
        setInspect(data);
      } else if (activeTab === "events") {
        const { data } = await api.get(`/containers/${id}/restart-history`);
        setEvents(data);
      } else if (activeTab === "metrics" || activeTab === "overview") {
        await loadMetrics();
      }
    } catch {}
    setTabLoading(false);
  }, [id, activeTab, loadMetrics]);

  useEffect(() => {
    setTimeout(() => loadBase(), 0);
  }, [loadBase]);

  useEffect(() => {
    setTimeout(() => loadTab(), 0);
  }, [loadTab]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 16 }}>
      <RefreshCw size={32} className="spin" color="var(--primary)" />
      <div style={{ fontSize: 18, color: "var(--text-secondary)", fontWeight: 500 }}>Loading Container Details...</div>
    </div>
  );
  if (!container) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 16 }}>
      <Box size={48} color="var(--color-critical)" opacity={0.5} />
      <div style={{ fontSize: 20, color: "var(--color-critical)", fontWeight: 600 }}>Container Not Found</div>
      <button onClick={() => router.push(routes.containers)} className="btn btn-secondary">Return to Containers</button>
    </div>
  );

  const isRunning = container.status === "running";
  const isExited = container.status === "exited" || container.status === "dead";

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  const tabs: { id: Tab, label: string, icon: any }[] = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "metrics", label: "Metrics", icon: Activity },
    { id: "processes", label: "Processes", icon: Settings },
    { id: "logs", label: "Logs", icon: Terminal },
    { id: "inspect", label: "Inspect", icon: Network },
    { id: "events", label: "Events", icon: ShieldAlert },
  ];

  return (
    <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      {/* Breadcrumb & Back */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.back()} className="btn" style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.2s" }}>
          <ChevronLeft size={16} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>
          <span style={{ cursor: "pointer", transition: "color 0.2s" }} onClick={() => router.push(routes.home)} onMouseOver={(e) => e.currentTarget.style.color="var(--primary)"} onMouseOut={(e) => e.currentTarget.style.color="var(--text-muted)"}>Overview</span>
          <span>/</span>
          <span style={{ cursor: "pointer", transition: "color 0.2s" }} onClick={() => router.push(routes.containers)} onMouseOver={(e) => e.currentTarget.style.color="var(--primary)"} onMouseOut={(e) => e.currentTarget.style.color="var(--text-muted)"}>Containers</span>
          <span>/</span>
          <span style={{ color: "var(--text-primary)" }}>{container.name}</span>
        </div>
      </div>
      
      {/* Header */}
      <div className="flex-between" style={{ background: "var(--bg-primary)", padding: "24px 32px", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ padding: 8, background: isRunning ? "rgba(34,197,94,0.1)" : isExited ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", borderRadius: 8, color: isRunning ? "#22c55e" : isExited ? "#ef4444" : "#f59e0b", display: "flex" }}>
              <Box size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 12 }}>
              {container.name}
              <span style={{ 
                background: isRunning ? "rgba(34,197,94,0.1)" : isExited ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                color: isRunning ? "#22c55e" : isExited ? "#ef4444" : "#f59e0b",
                border: `1px solid ${isRunning ? "rgba(34,197,94,0.2)" : isExited ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, letterSpacing: 0.5
              }}>
                {container.status?.toUpperCase()}
              </span>
              {container.health_status && container.health_status !== "N/A" && (
                <span style={{ 
                  background: container.health_status === "healthy" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  color: container.health_status === "healthy" ? "#22c55e" : "#ef4444",
                  border: `1px solid ${container.health_status === "healthy" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, letterSpacing: 0.5
                }}>
                  {container.health_status.toUpperCase()}
                </span>
              )}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-secondary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Terminal size={14} /> {container.container_id.substring(0,12)}</span>
            <span style={{ color: "var(--border)" }}>|</span>
            <span>Image: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{container.image}</strong></span>
            <span style={{ color: "var(--border)" }}>|</span>
            <span>Server: <strong style={{ color: "var(--primary)", fontWeight: 500 }}>{container.server_name}</strong></span>
          </div>
        </div>
        <div>
          <button onClick={() => { loadBase(); loadTab(); }} className="btn" style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "0 20px", height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"} onMouseOut={(e) => e.currentTarget.style.opacity = "1"}>
            <RefreshCw size={16} className={tabLoading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 8, overflowX: "auto" }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: "relative",
                background: "none",
                border: "none",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--primary)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "color 0.2s"
              }}
            >
              <tab.icon size={16} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 3, background: "var(--primary)", borderRadius: "3px 3px 0 0" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading Progress */}
      {tabLoading && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ height: 3, background: "linear-gradient(90deg, transparent, var(--primary), transparent)", backgroundSize: "200% 100%", borderRadius: 2, marginTop: -24, animation: "gradientMove 2s linear infinite" }} 
        />
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ minHeight: 400 }}
        >
          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--border)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    <Cpu size={14} color="var(--primary)" /> CPU USAGE
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2, marginTop: 4 }}>
                    {container.last_cpu_percent != null ? `${container.last_cpu_percent.toFixed(1)}%` : "0.0%"}
                  </div>
                </div>
                <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--border)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    <MemoryStick size={14} color="#22c55e" /> MEMORY USAGE
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2, marginTop: 4 }}>
                    {formatBytes(container.last_mem_usage || 0)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                    Limit: <span style={{ color: "var(--text-secondary)" }}>{formatBytes(container.last_mem_limit || 0)}</span>
                  </div>
                </div>
                <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--border)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    <RotateCcw size={14} color={container.restart_count > 0 ? "#f59e0b" : "var(--primary)"} /> RESTARTS
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: container.restart_count > 0 ? "#f59e0b" : "var(--text-primary)", lineHeight: 1.2, marginTop: 4 }}>
                    {container.restart_count || 0}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                    Status: {container.oom_killed ? <span style={{ color: "#ef4444", fontWeight: 600 }}>OOM Killed</span> : <span style={{ color: "#22c55e" }}>Normal Exit Code</span>}
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 0, border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", fontWeight: 600, fontSize: 14 }}>
                  Container Configuration
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ width: 250, padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Container ID</td>
                        <td style={{ padding: "12px 20px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{container.container_id}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Image</td>
                        <td style={{ padding: "12px 20px", fontFamily: "var(--font-mono)", color: "var(--primary)", fontWeight: 500 }}>{container.image}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Server</td>
                        <td style={{ padding: "12px 20px", color: "var(--text-primary)", fontWeight: 500 }}>{container.server_name}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Created At</td>
                        <td style={{ padding: "12px 20px", color: "var(--text-primary)" }}>{new Date(container.created_at).toLocaleString()}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Network Mode</td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{ padding: "2px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{container.network_mode || "bridge"}</span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Published Ports</td>
                        <td style={{ padding: "12px 20px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {container.ports ? (
                            typeof container.ports === "string" ? container.ports : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {Object.entries(container.ports).map(([k,v]) => (
                                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ color: "var(--primary)" }}>{k}</span> <ArrowUpRight size={14}/> {v}
                                  </div>
                                ))}
                              </div>
                            )
                          ) : "No published ports"}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontWeight: 500 }}>Mounted Volumes</td>
                        <td style={{ padding: "12px 20px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: 13 }}>
                          {container.volumes && Array.isArray(container.volumes) && container.volumes.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {container.volumes.map((v, i) => (
                                <div key={i} style={{ background: "var(--bg-elevated)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", display: "inline-block", wordBreak: "break-all" }}>{v}</div>
                              ))}
                            </div>
                          ) : container.volumes ? String(container.volumes) : "No volumes mounted"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Metrics ── */}
          {activeTab === "metrics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", gap: 8, background: "var(--bg-secondary)", padding: 6, borderRadius: 10, width: "fit-content", border: "1px solid var(--border)" }}>
                {["1h", "6h", "24h", "7d"].map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={{ 
                    padding: "6px 16px", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none",
                    background: period === p ? "var(--bg-elevated)" : "transparent",
                    color: period === p ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: period === p ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.2s"
                  }}>
                    {p}
                  </button>
                ))}
              </div>
              
              {metrics.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Activity size={32} color="var(--text-muted)" opacity={0.5} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>No Metrics Available</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400 }}>Historical metric data is not available yet. Data points are collected every 30 seconds while the container is running.</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 20 }}>
                  <div className="card" style={{ padding: 16, border: "1px solid var(--border)" }}>
                    <TimeSeriesChart title="CPU Usage" data={metrics as any} series={[{ key: "cpu_percent", name: "CPU %", color: "var(--color-primary)", type: "area" }]} valueSuffix="%" syncId="container-metrics" height={220} />
                  </div>
                  <div className="card" style={{ padding: 16, border: "1px solid var(--border)" }}>
                    <TimeSeriesChart title="Memory Usage" data={metrics as any} series={[{ key: "mem_usage", name: "RAM", color: "#22c55e", type: "area" }]} formatValue={formatBytes} syncId="container-metrics" height={220} />
                  </div>
                  <div className="card" style={{ padding: 16, border: "1px solid var(--border)" }}>
                    <TimeSeriesChart title="Network RX" data={metrics as any} series={[{ key: "net_rx_rate", name: "RX", color: "#3b82f6", type: "area" }]} formatValue={(v) => `${formatBytes(v)}/s`} syncId="container-metrics" height={220} />
                  </div>
                  <div className="card" style={{ padding: 16, border: "1px solid var(--border)" }}>
                    <TimeSeriesChart title="Network TX" data={metrics as any} series={[{ key: "net_tx_rate", name: "TX", color: "#f59e0b", type: "area" }]} formatValue={(v) => `${formatBytes(v)}/s`} syncId="container-metrics" height={220} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Processes ── */}
          {activeTab === "processes" && (
            <div>
              {tabLoading && processes.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading processes via SSH...</div>
              ) : processes.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Settings size={32} color="var(--text-muted)" opacity={0.5} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>No Processes Found</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400 }}>
                    The container might be stopped, or the agent lacks permissions to list internal container processes via SSH.
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, border: "1px solid var(--border)" }}>
                  <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", alignItems: "center", gap: 12 }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input 
                      type="text" 
                      placeholder="Search processes (PID, User, Command)..." 
                      value={processSearch}
                      onChange={e => setProcessSearch(e.target.value)}
                      style={{ background: "transparent", border: "none", color: "var(--text-primary)", fontSize: 14, width: "100%", outline: "none" }}
                    />
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                        <tr>
                          {Object.keys(processes[0]).map(k => (
                            <th key={k} style={{ padding: "14px 24px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 }}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {processes.filter(p => Object.values(p).join(" ").toLowerCase().includes(processSearch.toLowerCase())).map((p, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }} className="hover-bg-input">
                            {Object.values(p).map((v, j) => (
                              <td key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 13, padding: "12px 24px", color: String(v).match(/^[0-9]+$/) ? "var(--primary)" : "var(--text-primary)" }}>{String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Logs ── */}
          {activeTab === "logs" && (
            <div style={{ height: 650, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
              <LogViewer logs={logs} onRefresh={loadTab} loading={tabLoading} title={`Logs: ${container.name}`} />
            </div>
          )}

          {/* ── Inspect ── */}
          {activeTab === "inspect" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {tabLoading && Object.keys(inspect ?? {}).length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Fetching inspect data...</div>
              ) : Object.keys(inspect ?? {}).length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Network size={32} color="var(--text-muted)" opacity={0.5} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>No Inspect Data Available</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Ensure the agent is running and has permissions to inspect containers.</div>
                </div>
              ) : (
                <>
                  <div className="card" style={{ padding: 0, border: "1px solid var(--border)" }}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", fontWeight: 600, fontSize: 16 }}>
                      Environment Variables
                    </div>
                    <div style={{ padding: 24, maxHeight: 400, overflowY: "auto" }}>
                      {Array.isArray((inspect?.Config as Record<string,unknown>)?.Env) && (inspect?.Config as Record<string,string[]>)?.Env?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {((inspect.Config as Record<string,string[]>).Env).map((e: string, i: number) => {
                            const [k, ...v] = e.split("=");
                            const val = v.join("=");
                            const isSecret = /pass|secret|key|token|auth/i.test(k);
                            return (
                              <div key={i} style={{ display: "flex", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 14, fontFamily: "var(--font-mono)" }}>
                                <span style={{ color: "var(--primary)", width: 250, flexShrink: 0, fontWeight: 600 }}>{k}</span>
                                <span style={{ color: isSecret ? "var(--text-muted)" : "var(--text-secondary)", wordBreak: "break-all" }}>
                                  {isSecret ? "••••••••••••••••" : (val || '""')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color: "var(--text-muted)" }}>No environment variables defined.</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="card" style={{ padding: 0, border: "1px solid var(--border)" }}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", fontWeight: 600, fontSize: 16 }}>
                      Raw JSON Output
                    </div>
                    <div style={{ padding: 24, overflowX: "auto", maxHeight: 500, background: "#0d1117" }}>
                      <pre style={{
                        color: "#c9d1d9", fontFamily: "var(--font-mono)", fontSize: 13,
                        whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0, lineHeight: 1.6
                      }}>
                        {JSON.stringify(inspect, (key, value) => {
                          if (typeof key === "string" && /pass|secret|key|token|auth/i.test(key) && typeof value === "string") return "********";
                          return value;
                        }, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Events ── */}
          {activeTab === "events" && (
            <div style={{ paddingBottom: 24 }}>
              {tabLoading && events.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading history...</div>
              ) : events.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <ShieldAlert size={32} color="var(--text-muted)" opacity={0.5} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>No Events Recorded</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400 }}>Restart events, stops, and state changes will appear in this timeline.</div>
                </div>
              ) : (
                <div className="card" style={{ padding: "32px 40px", border: "1px solid var(--border)" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: "var(--border)" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {events.map((e, index) => (
                        <motion.div 
                          key={e.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          style={{ display: "flex", gap: 24, position: "relative" }}
                        >
                          <div style={{ 
                            width: 40, height: 40, borderRadius: "50%", 
                            background: "var(--bg-primary)", border: `2px solid ${e.event_type === "started" ? "#22c55e" : e.event_type === "oom_killed" ? "#ef4444" : "#f59e0b"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            position: "relative", zIndex: 2, flexShrink: 0
                          }}>
                            <Activity size={18} color={e.event_type === "started" ? "#22c55e" : e.event_type === "oom_killed" ? "#ef4444" : "#f59e0b"} />
                          </div>
                          <div style={{ flex: 1, padding: "20px 24px", background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{e.event_type}</span>
                              <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(e.occurred_at).toLocaleString()}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, fontSize: 14 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>Exit Code</span>
                                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 16, fontWeight: 600 }}>{e.exit_code ?? "-"}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>Total Restarts</span>
                                <span style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 600 }}>{e.restart_count}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>OOM Killed</span>
                                {e.oom_killed ? <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 16 }}>YES</span> : <span style={{ color: "#22c55e", fontWeight: 600, fontSize: 16 }}>NO</span>}
                              </div>
                            </div>
                            {e.reason && (
                              <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--bg-secondary)", borderLeft: "3px solid var(--color-warning)", borderRadius: "0 6px 6px 0", fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic" }}>
                                {e.reason}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
