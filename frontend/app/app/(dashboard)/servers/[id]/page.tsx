"use client";
import { routes } from "@/lib/routes";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import type {
  Server, Container, ServerMetricPoint as BaseServerMetricPoint,
  ListeningPort, Alert
} from "@/types";

interface ServerMetricPoint extends BaseServerMetricPoint {
  [key: string]: string | number | undefined;
}

import { formatPercent, formatLastSeen, metricColor, safeValue, formatDateTime } from "@/lib/formatters";
import { Server as ServerIcon, Activity, RefreshCw, LayoutTemplate, Clock, Settings, Box, Shield, AlertTriangle, ArrowRight, Zap, Cpu, HardDrive, Network, Layers, Terminal, Sparkles, X, Info, Send, User } from "lucide-react";
import { TimeSeriesChart, TimeRangeSelector, TimeRange } from "@/components/ui/charts";
import { motion, AnimatePresence } from "framer-motion";

function bytes(b: number | undefined | null): string {
  if (b == null) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = b;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)}${units[i]}`;
}

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [server, setServer] = useState<Server | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [history, setHistory] = useState<ServerMetricPoint[]>([]);
  const [ports, setPorts] = useState<ListeningPort[]>([]);
  const [cron, setCron] = useState<{ output?: string }[]>([]);
  const [nginx, setNginx] = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<Record<string, { is_active?: string; show?: string }>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [processes, setProcesses] = useState<Record<string, any>[]>([]);
  const [disk, setDisk] = useState<any[]>([]);
  const [network, setNetwork] = useState<any[]>([]);
  
  const [period, setPeriod] = useState<TimeRange>("1h");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("Resource Trends");
  
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: "user" | "ai", text: string, error?: boolean}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      if (tabParam === "processes") setActiveTab("Top Processes");
      else if (tabParam === "containers") setActiveTab("Containers");
      else if (tabParam === "storage") setActiveTab("Storage Pressure");
      else if (tabParam === "network" || tabParam === "ports") setActiveTab("Network & Ports");
      else if (tabParam === "alerts") setActiveTab("Active Alerts");
    }
  }, [searchParams]);
  
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!loading) setRefreshing(true);
    try {
      const [sRes, cRes, hRes, dRes, nRes, aRes, pRes, ptsRes, nginxRes, srvRes] = await Promise.allSettled([
        api.get(`/servers/${id}`),
        api.get(`/containers?server_id=${id}`),
        api.get(`/servers/${id}/metrics/history?period=${period}`),
        api.get(`/servers/${id}/disk`),
        api.get(`/servers/${id}/network`),
        api.get(`/alerts?server_id=${id}&status=active`),
        api.get(`/servers/${id}/processes`),
        api.get(`/servers/${id}/ports`),
        api.get(`/servers/${id}/nginx`),
        api.get(`/servers/${id}/services`),
      ]);

      if (!mounted.current) return;

      if (sRes.status === "fulfilled") setServer(sRes.value.data);
      else router.push(routes.servers); // Failed to fetch server identity
      
      if (cRes.status === "fulfilled") setContainers(cRes.value.data || []);
      if (hRes.status === "fulfilled") setHistory(hRes.value.data || []);
      
      if (dRes.status === "fulfilled") {
          // If fallback format or agent format
          const diskData = dRes.value.data?.disks || dRes.value.data || [];
          setDisk(Array.isArray(diskData) ? diskData : []);
      }
      
      if (nRes.status === "fulfilled") {
          const netData = nRes.value.data?.interfaces || nRes.value.data || [];
          setNetwork(Array.isArray(netData) ? netData : []);
      }
      
      if (aRes.status === "fulfilled") {
          // Filter again defensively to avoid duplicates and non-active
          const activeAlerts: Alert[] = ((aRes.value.data || []) as Alert[]).filter((a: Alert) => a.status === 'active');
          const uniqueAlerts: Alert[] = Array.from(new Map<string, Alert>(activeAlerts.map((a: Alert) => [a.id, a])).values());
          setAlerts(uniqueAlerts);
      }
      
      if (pRes.status === "fulfilled") {
          const procs = pRes.value.data?.processes || pRes.value.data || [];
          setProcesses(Array.isArray(procs) ? procs : []);
      }
      
      if (nginxRes.status === "fulfilled") setNginx(nginxRes.value.data || null);
      if (srvRes.status === "fulfilled") setServices(srvRes.value.data || {});

      if (ptsRes.status === "fulfilled") {
          const portsData = ptsRes.value.data?.listening || ptsRes.value.data || [];
          if (Array.isArray(portsData) && portsData.length > 0 && typeof portsData[0] === 'object') {
              setPorts(portsData);
          } else if (typeof ptsRes.value.data?.output === 'string') {
              // Legacy parsing
              const lines = (ptsRes.value.data?.output || "").split("\n");
              const parsed = lines.slice(1).filter((l: string) => l.trim().length > 0).map((l: string) => {
                const parts = l.split(/\s+/);
                return { protocol: parts[0], address: parts[4], process: parts[6] || "" };
              });
              setPorts(parsed);
          } else {
              setPorts([]);
          }
      }
      
    } catch {
      // safe
    } finally {
      if (mounted.current) {
         setLoading(false);
         setRefreshing(false);
      }
    }
  }, [id, period, router, loading]);

  useEffect(() => { 
    const timer = setTimeout(() => load(), 0);
    const iv = setInterval(load, 15000); 
    return () => { clearTimeout(timer); clearInterval(iv); }; 
  }, [load]);

  if (loading || !server) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-secondary)" }}>
      <RefreshCw size={24} className="spin" style={{ marginRight: 8 }} /> Loading server command center...
    </div>
  );

  const cpu = safeValue(server.last_cpu_percent, null);
  const ram = safeValue(server.last_ram_percent, null);
  const diskPct = safeValue(server.last_disk_percent, null);
  const pctColor = (v: number | null) => v === null ? "var(--text-muted)" : metricColor(v);

  let healthReason = "";
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text }]);
    setIsChatLoading(true);

    try {
      const res = await api.post("/ai/chat", { 
        messages: [
          { role: "system", content: `You are an expert infrastructure AI analyzing server: ${server?.name}. The server is currently ${server?.status}.` },
          ...chatMessages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
          { role: "user", content: text }
        ],
        context: {
          server_id: server?.id,
          page: "servers",
          entity_type: "server",
          entity_id: server?.id
        }
      });
      setChatMessages(prev => [...prev, { role: "ai", text: res.data.reply }]);
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || "Failed to get a response. Please check your OpenAI API key.";
      setChatMessages(prev => [...prev, { role: "ai", text: errMsg, error: true }]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  };

  if (server.status === "critical" || server.status === "warning") {
     if (cpu !== null && cpu > 90) healthReason = `CPU usage ${cpu.toFixed(1)}% exceeds critical threshold.`;
     else if (ram !== null && ram > 90) healthReason = `RAM usage ${ram.toFixed(1)}% exceeds critical threshold.`;
     else if (diskPct !== null && diskPct > 90) healthReason = `Disk usage ${diskPct.toFixed(1)}% exceeds critical threshold.`;
     else if (alerts.length > 0) healthReason = `${alerts.length} active alerts currently affecting this server.`;
     else healthReason = "Server health checks are failing or unresponsive.";
  }

  const runningContainers = containers.filter(c => c.status === "running").length;
  const stoppedContainers = containers.filter(c => c.status === "exited" || c.status === "stopped").length;
  const unhealthyContainers = containers.filter(c => c.status === "unhealthy").length;
  
  const handleAnalyzeAI = () => {
     setIsAiPanelOpen(true);
     // Also dispatch in case global listener exists
     window.dispatchEvent(new CustomEvent('open-ai-chat', { 
        detail: { 
           serverId: id, 
           serverName: server.name, 
           health: server.status, 
           env: server.environment,
           context: "server_details" 
        } 
     }));
  };

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <div className="fade-in server-command-center" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 64 }}>
      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
         <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="breadcrumb" style={{ marginBottom: 0 }}>
            <Link href={routes.home}>Overview</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={routes.servers}>Servers</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{server.name}</span>
            </div>
         </div>
      </div>

      {/* HEADER IDENTITY */}
      <div className="flex-between" style={{ background: "var(--bg-primary)", padding: "24px 32px", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
           <div style={{ padding: 12, background: server.status === "online" ? "rgba(34,197,94,0.1)" : server.status === "warning" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)", borderRadius: 12, color: server.status === "online" ? "#22c55e" : server.status === "warning" ? "#f59e0b" : "#ef4444", display: "flex" }}>
              <ServerIcon size={28} />
           </div>
           <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                 <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 12 }}>
                    {server.name}
                 </h1>
                 <span style={{ 
                    background: server.status === "online" ? "rgba(34,197,94,0.1)" : server.status === "warning" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                    color: server.status === "online" ? "#22c55e" : server.status === "warning" ? "#f59e0b" : "#ef4444",
                    border: `1px solid ${server.status === "online" ? "rgba(34,197,94,0.2)" : server.status === "warning" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
                    padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, letterSpacing: 0.5
                 }}>{server.status.toUpperCase()}</span>
                 <span style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-secondary)" }}>{server.environment || "Unknown"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-secondary)" }}>
                 <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Network size={14} /> {server.ip_address}</span>
                 {server.hostname && <><span style={{ color: "var(--border)" }}>|</span><span>{server.hostname}</span></>}
                 <span style={{ color: "var(--border)" }}>|</span>
                 <span>{(server as any).os || "Linux"} {(server as any).architecture || ""}</span>
                 <span style={{ color: "var(--border)" }}>|</span>
                 <span>{server.last_success_at ? `Freshness: ${formatLastSeen(server.last_success_at)}` : "No recent data"}</span>
              </div>
           </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
           <button onClick={handleAnalyzeAI} className="btn" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#c4b5fd", border: "1px solid rgba(139, 92, 246, 0.3)", padding: "0 16px", height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)"} onMouseOut={(e) => e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)"}>
              <Sparkles size={16} /> Analyze with AI
           </button>
           <TimeRangeSelector value={period} onChange={setPeriod} liveStatus={server.status === "online" ? "LIVE" : "STALE"} />
           <button onClick={() => load()} className="btn" style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "0 20px", height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"} onMouseOut={(e) => e.currentTarget.style.opacity = "1"}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} /> Refresh
           </button>
        </div>
      </div>

      {/* HEALTH EXPLANATION */}
      {healthReason && (
         <div className="card" style={{ padding: "16px 24px", background: server.status === "critical" ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)", borderColor: server.status === "critical" ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)", display: "flex", gap: 16, alignItems: "flex-start" }}>
            <AlertTriangle size={24} color={server.status === "critical" ? "var(--color-critical)" : "var(--color-warning)"} style={{ marginTop: 2 }} />
            <div>
               <h3 style={{ margin: "0 0 4px 0", color: server.status === "critical" ? "var(--color-critical)" : "var(--color-warning)", fontSize: 16 }}>{server.status.toUpperCase()} STATUS</h3>
               <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Primary reason: <strong>{healthReason}</strong></div>
               <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  <span>CPU: {cpu !== null ? cpu.toFixed(1) + "%" : "Unavailable"}</span>
                  <span>RAM: {ram !== null ? ram.toFixed(1) + "%" : "Unavailable"}</span>
                  <span>Disk: {diskPct !== null ? diskPct.toFixed(1) + "%" : "Unavailable"}</span>
                  <span>Alerts: {alerts.length} active</span>
               </div>
            </div>
         </div>
      )}

      {/* CURRENT RESOURCE OVERVIEW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
         {[
            { label: "CPU", value: cpu !== null ? formatPercent(cpu, 1) : "Unavailable", color: pctColor(cpu), icon: Cpu, action: () => setActiveTab("Resource Trends") },
            { label: "RAM", value: ram !== null ? formatPercent(ram, 1) : "Unavailable", color: pctColor(ram), icon: Layers, action: () => setActiveTab("Resource Trends") },
            { label: "DISK", value: diskPct !== null ? formatPercent(diskPct, 1) : "Unavailable", color: pctColor(diskPct), icon: HardDrive, action: () => setActiveTab("Storage Pressure") },
            { label: "LOAD", value: safeValue<number | string>((server as any).load_avg, "Unavailable"), icon: Activity, action: () => setActiveTab("Resource Trends") },
            { label: "DOCKER", value: containers.length, icon: Box, action: () => setActiveTab("Containers") },
            { label: "NETWORK", value: network.length > 0 ? "Active" : "Unavailable", color: network.length > 0 ? "var(--color-healthy)" : "var(--text-muted)", icon: Network, action: () => setActiveTab("Network & Ports") },
            { label: "ALERTS", value: alerts.length || "0", color: alerts.length > 0 ? "var(--color-critical)" : "var(--text-secondary)", icon: AlertTriangle, action: () => setActiveTab("Active Alerts") },
         ].map(({ label, value, color, icon: Icon, action }) => (
            <div key={label} onClick={action} className="card hover-3d" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--border)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", cursor: "pointer" }}>
               <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                  <Icon size={14} color={color || "var(--primary)"} /> {label}
               </div>
               <div style={{ fontSize: 24, fontWeight: 700, color: color || "var(--text-primary)", lineHeight: 1.2, marginTop: 4 }}>
                  {value}
               </div>
            </div>
         ))}
      </div>

      {/* TABS MENU */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 8, overflowX: "auto", marginBottom: 8 }}>
        {["Resource Trends", "Containers", "Top Processes", "Storage Pressure", "Network & Ports", "Active Alerts", "Services & Config"].map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
                transition: "color 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {tab === "Active Alerts" ? `Active Alerts (${alerts.length})` : tab}
              {isActive && (
                <motion.div
                  layoutId="serverActiveTabIndicator"
                  style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 3, background: "var(--primary)", borderRadius: "3px 3px 0 0" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Loading Progress */}
      {refreshing && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ height: 3, background: "linear-gradient(90deg, transparent, var(--primary), transparent)", backgroundSize: "200% 100%", borderRadius: 2, marginTop: -24, animation: "gradientMove 2s linear infinite" }} 
        />
      )}

      {/* TAB CONTENT */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ minHeight: 400, display: "flex", flexDirection: "column", gap: 24 }}
        >
        
        {/* RESOURCE TRENDS */}
        {activeTab === "Resource Trends" && (
          <div>
             <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 8 }}><Activity size={18}/> Resource Trends</h2>
             {history.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 20 }}>
                   <TimeSeriesChart
                      title="CPU Usage %"
                      syncId="server-metrics"
                      data={history}
                      series={[{ key: "cpu_percent", name: "CPU", color: "var(--color-blue)", type: "area" }]}
                      valueSuffix="%"
                      height={220}
                      thresholds={[{ value: 80, label: "Warning", color: "var(--color-warning)" }, { value: 95, label: "Critical", color: "var(--color-critical)" }]}
                   />
                   <TimeSeriesChart
                      title="RAM Usage"
                      syncId="server-metrics"
                      data={history}
                      series={[{ key: "ram_used", name: "RAM", color: "var(--color-purple)", type: "area" }]}
                      formatValue={(v) => bytes(v)}
                      height={220}
                   />
                   <TimeSeriesChart
                      title="Load Average"
                      syncId="server-metrics"
                      data={history}
                      series={[{ key: "load_1", name: "1m", color: "var(--color-orange)", type: "area" }, { key: "load_5", name: "5m", color: "var(--color-yellow)", type: "area" }]}
                      height={220}
                   />
                   <TimeSeriesChart
                      title="Network Traffic"
                      syncId="server-metrics"
                      data={history}
                      series={[{ key: "net_rx_rate", name: "RX", color: "var(--color-green)", type: "area" }, { key: "net_tx_rate", name: "TX", color: "var(--color-blue)", type: "area" }]}
                      formatValue={(v) => `${bytes(v)}/s`}
                      height={220}
                   />
                </div>
             ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", background: "var(--bg-elevated)", borderRadius: 8, border: "1px dashed var(--border)" }}>
                   No historical data available.
                </div>
             )}
          </div>
        )}

        {/* CONTAINERS */}
        {activeTab === "Containers" && (
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
             <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Box size={16}/> Containers <span style={{ fontSize: 12, fontWeight: "normal", color: "var(--text-muted)", marginLeft: 4 }}>({containers.length} Total, {runningContainers} Running)</span></h3>
             </div>
             <div style={{ padding: 0, flex: 1, overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", minWidth: 600 }}>
                   <thead><tr><th>Container</th><th>State</th><th>CPU</th><th>MEM</th></tr></thead>
                   <tbody>
                      {containers.length === 0 ? (
                         <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No Docker containers detected.</td></tr>
                      ) : containers.map(c => {
                         const cpuPct = c.last_cpu_percent || 0;
                         const memPct = c.last_mem_limit ? (c.last_mem_usage! / c.last_mem_limit * 100) : 0;
                         return (
                            <tr key={c.id}>
                               <td style={{ fontWeight: 600 }}>{c.name}<div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{(c.image || "unknown").split(":")[0]}</div></td>
                               <td><span className={`badge ${c.status === "running" ? "badge-running" : c.status === "unhealthy" ? "badge-critical" : "badge-warning"}`} style={{ fontSize: 10 }}>{c.status.toUpperCase()}</span></td>
                               <td style={{ color: pctColor(cpuPct), fontFamily: "var(--font-mono)" }}>{cpuPct.toFixed(1)}%</td>
                               <td style={{ color: pctColor(memPct), fontFamily: "var(--font-mono)" }}>{memPct.toFixed(1)}%</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* PROCESSES */}
        {activeTab === "Top Processes" && (
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
             <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Terminal size={16}/> Top Processes</h3>
             </div>
             <div style={{ padding: 0, flex: 1, overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", minWidth: 600 }}>
                   <thead><tr><th>PID / User</th><th>Command</th><th>CPU</th><th>MEM</th></tr></thead>
                   <tbody>
                      {processes.length === 0 ? (
                         <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No process data available.</td></tr>
                      ) : processes.sort((a,b) => (b.cpu_percent || 0) - (a.cpu_percent || 0)).map((p, i) => (
                         <tr key={i}>
                            <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                               <div style={{ color: "var(--text-primary)" }}>{p.pid || p.PID}</div>
                               <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{p.user || p.USER}</div>
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.command || p.COMMAND}>{p.command || p.COMMAND || p.name}</td>
                            <td style={{ color: Number(p.cpu_percent || p["%CPU"]) > 50 ? "var(--color-critical)" : Number(p.cpu_percent || p["%CPU"]) > 20 ? "var(--color-warning)" : "inherit", fontFamily: "var(--font-mono)" }}>{Number(p.cpu_percent || p["%CPU"] || 0).toFixed(1)}%</td>
                            <td style={{ color: Number(p.memory_percent || p["%MEM"]) > 50 ? "var(--color-critical)" : Number(p.memory_percent || p["%MEM"]) > 20 ? "var(--color-warning)" : "inherit", fontFamily: "var(--font-mono)" }}>{Number(p.memory_percent || p["%MEM"] || 0).toFixed(1)}%</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* STORAGE */}
        {activeTab === "Storage Pressure" && (
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
             <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><HardDrive size={16}/> Storage Pressure</h3>
             </div>
             <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 32 }}>
                {disk.length === 0 ? (
                   <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", gridColumn: "1 / -1" }}>Storage telemetry unavailable</div>
                ) : [...disk].sort((a, b) => {
                   const getScore = (d: any) => {
                       const pct = d.use_percent != null ? d.use_percent : (d.total > 0 ? Math.round((d.used / d.total) * 100) : 0);
                       if (pct >= 90) return 5;
                       if (pct >= 80) return 4;
                       if (d.is_docker_data) return 3;
                       if (d.mount_point === "/") return 2;
                       return 1;
                   };
                   return getScore(b) - getScore(a);
                }).map((d: any, i) => {
                   const pct = d.use_percent != null ? d.use_percent : (d.total > 0 ? Math.round((d.used / d.total) * 100) : 0);
                   const isUnknown = d.total === 0 || d.total == null;
                   
                   let status = "Healthy";
                   if (pct >= 90) status = "Critical";
                   else if (pct >= 80) status = "Warning";

                   return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                               <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)", fontWeight: 600, fontSize: 16 }} title={d.mount_point}>{d.mount_point}</span>
                               <span style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>{d.filesystem || d.device}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {d.is_docker_data && <span className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.2)", fontSize: 11 }}>Docker Data</span>}
                                <span style={{ color: status === "Critical" ? "var(--color-critical)" : status === "Warning" ? "var(--color-warning)" : "var(--color-healthy)", fontSize: 13, fontWeight: 500 }}>{status}</span>
                            </div>
                         </div>
                         <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-primary)" }}>
                            {!isUnknown && <span>{bytes(d.used)} used / {bytes(d.total)}</span>}
                            {isUnknown && <span>{d.used_raw || bytes(d.used)} used</span>}
                            <span>{pct}%</span>
                         </div>
                         <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginTop: -4 }}>
                            {!isUnknown && <span>{bytes(d.free)} free</span>}
                         </div>
                         <div style={{ height: 10, background: "var(--bg-input)", borderRadius: 5, overflow: "hidden", marginTop: 2 }}>
                            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: status === "Critical" ? "var(--color-critical)" : status === "Warning" ? "var(--color-warning)" : "var(--color-blue)", borderRadius: 5, transition: "width 0.5s ease" }} />
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>
        )}

        {/* NETWORK & PORTS */}
        {activeTab === "Network & Ports" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
             <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Network size={16}/> Network Interfaces</h3>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                   {network.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>No network interfaces data available.</div> : network.map((iface: any) => (
                      <div key={iface.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontFamily: "var(--font-mono)" }}>
                         <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{iface.name}</span>
                         <span style={{ color: "var(--text-secondary)" }}>↓ {bytes(iface.rx_bytes)} &nbsp;&nbsp;&nbsp; ↑ {bytes(iface.tx_bytes)}</span>
                      </div>
                   ))}
                </div>
             </div>
             
             <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Shield size={16}/> Listening Services</h3>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 10 }}>
                   {ports.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", width: "100%", padding: 16 }}>No open ports detected.</div> : ports.map((p: any, i) => {
                      const proto = p.protocol || "tcp";
                      const port = p.port || (p.address && p.address.split(":").pop()) || "unknown";
                      const process = p.process || "Unmapped service";
                      return (
                          <div key={i} className="badge badge-info" style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}>
                             {port}/{proto} <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{process}</span>
                          </div>
                      );
                   })}
                </div>
             </div>
          </div>
        )}

        {/* ALERTS */}
        {activeTab === "Active Alerts" && (
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
             <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={16}/> Active Alerts ({alerts.length})</h3>
             </div>
             <div style={{ padding: 0, overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", minWidth: 600 }}>
                   <thead><tr><th>Severity</th><th>Alert Context</th><th>Fired At</th></tr></thead>
                   <tbody>
                      {alerts.length === 0 ? (
                         <tr><td colSpan={3} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 15 }}>No active alerts. Server is healthy.</td></tr>
                      ) : alerts.map(a => (
                         <tr key={a.id} style={{ background: a.severity === "critical" ? "rgba(239, 68, 68, 0.04)" : "transparent" }}>
                            <td><span className="badge" style={{ background: a.severity === "critical" ? "var(--color-critical)" : "var(--color-warning)", color: "#fff", fontSize: 11, padding: "4px 8px" }}>{a.severity.toUpperCase()}</span></td>
                            <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 14 }}>{a.alert_name || a.title}</td>
                            <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{formatDateTime(a.created_at || (a as any).condition_started_at)}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* SERVICES & CONFIG */}
        {activeTab === "Services & Config" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
             
             {/* NGINX CONFIG */}
             <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><LayoutTemplate size={16}/> Nginx Status</h3>
                </div>
                <div style={{ padding: "20px", background: "var(--bg-card)", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", overflowX: "auto" }}>
                   {nginx ? JSON.stringify(nginx, null, 2) : "No Nginx data detected or collected."}
                </div>
             </div>
             
             {/* SYSTEMD SERVICES */}
             <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Settings size={16}/> Monitored System Services</h3>
                </div>
                <div style={{ padding: 0, overflowX: "auto" }}>
                   <table className="data-table" style={{ width: "100%" }}>
                      <thead><tr><th>Service Name</th><th>Status</th><th>Raw Output</th></tr></thead>
                      <tbody>
                         {Object.keys(services).length === 0 ? (
                            <tr><td colSpan={3} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No specific systemd services monitored.</td></tr>
                         ) : Object.entries(services).map(([name, s]) => (
                            <tr key={name}>
                               <td style={{ fontWeight: 600 }}>{name}</td>
                               <td><span className={`badge ${s.is_active === "active" ? "badge-running" : "badge-critical"}`}>{s.is_active?.toUpperCase() || "UNKNOWN"}</span></td>
                               <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.show || ""}>{s.show || ""}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>

          </div>
        )}

        </motion.div>
      </AnimatePresence>
      
      {/* AI Panel Drawer / Modal (Read-only) */}
      {isAiPanelOpen && (
         <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.5)" }} onClick={() => setIsAiPanelOpen(false)}>
            <style dangerouslySetInnerHTML={{ __html: `
              #global-ai-fab {
                 opacity: 0 !important;
                 visibility: hidden !important;
                 pointer-events: none !important;
              }
            `}} />
            <div style={{ width: "100%", maxWidth: 450, background: "var(--bg-card)", height: "100%", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border)", animation: "slideInRight 0.3s ease" }} onClick={e => e.stopPropagation()}>
               <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(139, 92, 246, 0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                     <Sparkles size={20} color="#c4b5fd" />
                     <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>AI Analysis Assistant</h3>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setIsAiPanelOpen(false)}>
                     <X size={20} />
                  </button>
               </div>
               
               <div style={{ padding: 16, borderBottom: "1px solid var(--border)", background: "rgba(59, 130, 246, 0.1)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Info size={18} color="var(--color-blue)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                     <strong>Read-only Analysis Mode.</strong> The AI can read metrics, processes, and logs from <strong>{server.name}</strong> to suggest optimizations and identify root causes. It cannot modify or restart services.
                  </p>
               </div>

               <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
                  <div style={{ alignSelf: "flex-start", background: "var(--bg-input)", padding: "12px 16px", borderRadius: "12px 12px 12px 0", fontSize: 14, color: "var(--text-primary)" }}>
                     Hello! I am analyzing <strong>{server.name}</strong> (Status: {server.status}). What would you like me to look into?
                  </div>
                  {healthReason && (
                     <div style={{ alignSelf: "flex-start", background: "var(--bg-input)", padding: "12px 16px", borderRadius: "12px 12px 12px 0", fontSize: 14, color: "var(--text-primary)" }}>
                        I noticed a potential issue: <span style={{ color: "var(--color-warning)" }}>{healthReason}</span>. Would you like me to dive deeper into this?
                     </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.role === "ai" ? (m.error ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.18)") : "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid " + (m.role === "ai" ? (m.error ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)") : "var(--border)") }}>
                        {m.role === "ai" ? (m.error ? <AlertTriangle size={14} color="#f87171" /> : <Sparkles size={14} color="#60a5fa" />) : <User size={14} color="#7a92b2" />}
                      </div>
                      <div style={{ maxWidth: "85%", background: m.role === "user" ? "var(--color-primary)" : (m.error ? "rgba(239,68,68,0.06)" : "var(--bg-input)"), color: m.role === "user" ? "#fff" : (m.error ? "#f87171" : "var(--text-primary)"), padding: "10px 14px", borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", fontSize: 13, border: m.role === "ai" ? (m.error ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border)") : "none", whiteSpace: "pre-wrap" }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(59,130,246,0.3)", flexShrink: 0 }}>
                        <Sparkles size={14} color="#60a5fa" />
                      </div>
                      <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", padding: "12px 16px", borderRadius: "12px 12px 12px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                        {[0, 1, 2].map(n => <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: `typingBounce 1.2s ease-in-out ${n * 0.18}s infinite` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
               </div>
               
               <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                     <input type="text" 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                        placeholder="Ask AI to analyze this server..." 
                        disabled={isChatLoading}
                        style={{ flex: 1, background: "var(--bg-input)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none", height: 40, opacity: isChatLoading ? 0.6 : 1 }} 
                     />
                     <button 
                        onClick={handleSendChat}
                        disabled={!chatInput.trim() || isChatLoading}
                        style={{ width: 40, height: 40, borderRadius: 8, background: chatInput.trim() && !isChatLoading ? "var(--color-primary)" : "var(--bg-input)", color: chatInput.trim() && !isChatLoading ? "#fff" : "var(--text-muted)", border: "none", cursor: chatInput.trim() && !isChatLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", flexShrink: 0 }}
                     >
                        <Send size={16} />
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
