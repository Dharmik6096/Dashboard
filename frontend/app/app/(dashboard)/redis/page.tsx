"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { 
  Database, CheckCircle, Cpu, Key, Users, Activity, Layers, 
  Server as ServerIcon, Settings, Lock, X, RefreshCw, ChevronLeft, 
  ChevronRight, ShieldAlert, BarChart3, Info, Network,
  Zap, Save, HardDrive
} from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { EnvironmentSelect } from "@/components/ui/EnvironmentSelect";

export default function RedisPage() {
  const [environment, setEnvironment] = useState("All Environments");
  const [serverFilter, setServerFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("LIVE");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  const [serverOptions, setServerOptions] = useState<{value: string, label: string}[]>([{ value: "all", label: "All Servers" }]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const buildParams = useCallback(() => {
    return {
      environment: environment === "All Environments" ? "all" : environment,
      server_id: serverFilter,
      role: roleFilter,
      period: timeRange === "LIVE" ? "1h" : timeRange,
      search,
      page,
      page_size: pageSize,
      sort: "status"
    };
  }, [environment, serverFilter, roleFilter, timeRange, search, page, pageSize]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const params = buildParams();
      const res = await api.get("/redis/dashboard", { params });
      setData(res.data);
    } catch (err: any) {
      setError(err.message || "Unable to load Redis monitoring data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (timeRange === "LIVE") {
        loadData(true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, timeRange]);

  useEffect(() => {
    api.get("/servers").then(r => {
      setServerOptions([{ value: "all", label: "All Servers" }, ...r.data.map((s:any) => ({ value: s.id, label: s.name }))]);
    }).catch(console.error);
  }, []);

  // Reset pagination on search change
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const roleOptions = useMemo(() => {
    return [
      { value: "all", label: "All Roles" },
      { value: "Primary", label: "Primary" },
      { value: "Replica", label: "Replica" },
      { value: "Standalone", label: "Standalone" }
    ];
  }, []);

  const summary = data?.summary || {};
  const instances = data?.instances || [];
  const pagination = data?.pagination || { page: 1, total_pages: 1 };
  const selectedInstance = useMemo(() => {
    return instances.find((i: any) => i.id === selectedInstanceId) || null;
  }, [instances, selectedInstanceId]);

  if (error && !data) {
    return (
      <div className="fade-in" style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: 24, borderRadius: "50%", marginBottom: 24 }}>
          <ShieldAlert size={48} style={{ color: "var(--color-critical)" }} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Connection Interrupted</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32, maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>{error}</p>
        <button 
          onClick={() => loadData()}
          style={{
            background: "linear-gradient(135deg, var(--color-info) 0%, #2563eb 100%)",
            color: "#fff", border: "none", padding: "12px 28px", borderRadius: 8,
            fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)", transition: "all 0.2s"
          }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <RefreshCw size={18} /> Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 32px", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* HEADER SECTION */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ 
            fontSize: 32, fontWeight: 800, margin: 0, 
            background: "linear-gradient(90deg, #ef4444 0%, #fca5a5 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            display: "flex", alignItems: "center", gap: 12, letterSpacing: "-0.5px"
          }}>
            <div style={{ 
              background: "rgba(239, 68, 68, 0.1)", padding: 10, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.2) inset",
              border: "1px solid rgba(239, 68, 68, 0.2)"
            }}>
              <Database size={28} color="#ef4444" />
            </div>
            Redis Cluster Intelligence
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 8, margin: "8px 0 0 52px", maxWidth: 600, lineHeight: 1.5 }}>
            Enterprise-grade visibility into your Redis infrastructure. Monitor memory utilization, keyspace metrics, and client activity in real-time.
          </p>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div style={{ 
        display: "flex", gap: 12, flexWrap: "nowrap", overflowX: "auto", alignItems: "center", 
        background: "rgba(22, 29, 46, 0.5)", padding: 16, borderRadius: 12, 
        border: "1px solid var(--border)", backdropFilter: "blur(10px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)", minHeight: 72
      }}>
        <EnvironmentSelect value={environment} onChange={setEnvironment} width={180} />
        <SearchableCombobox value={serverFilter} onChange={setServerFilter} options={serverOptions} placeholder="All Servers" width={180} />
        <SearchableCombobox value={roleFilter} onChange={setRoleFilter} options={roleOptions} placeholder="All Roles" width={140} />
        
        <div style={{ width: 1, height: 28, background: "var(--border-subtle)", margin: "0 8px" }} />
        
        <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", padding: 4 }}>
          {["LIVE", "5m", "15m", "1h", "24h"].map(tr => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              style={{
                background: timeRange === tr ? "var(--bg-active)" : "transparent",
                color: timeRange === tr ? "var(--text-primary)" : "var(--text-muted)",
                border: "none", padding: "6px 14px", fontSize: 13, cursor: "pointer", 
                fontWeight: timeRange === tr ? 600 : 500, borderRadius: 4, transition: "all 0.2s"
              }}
            >
              {tr === "LIVE" && <span style={{ color: "var(--color-healthy)", marginRight: 6, animation: "pulse 2s infinite" }}>●</span>}
              {tr}
            </button>
          ))}
        </div>

        <button 
          onClick={() => loadData(true)} 
          disabled={refreshing || loading}
          style={{ 
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, height: 38,
            background: "var(--bg-hover)", border: "1px solid var(--border-subtle)", 
            color: "var(--text-primary)", padding: "0 16px", borderRadius: 8, cursor: "pointer",
            fontWeight: 500, transition: "all 0.2s"
          }}
          onMouseOver={e => e.currentTarget.style.background = "var(--border-subtle)"}
          onMouseOut={e => e.currentTarget.style.background = "var(--bg-hover)"}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={16} className={refreshing ? "spin" : ""} color={refreshing ? "var(--color-info)" : "inherit"} />
            {timeRange === "LIVE" && !refreshing && (
              <svg width="24" height="24" style={{ position: "absolute", left: -4, top: -4, transform: "rotate(-90deg)" }}>
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="2" />
                <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-info)" strokeWidth="2" strokeDasharray="63" strokeDashoffset="0" style={{ animation: "countdown 10s linear infinite" }} />
              </svg>
            )}
          </div>
          <span style={{ fontSize: 13 }}>Auto-Refresh</span>
        </button>
      </div>

      {/* KPI METRICS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, alignItems: "stretch" }}>
        <KpiCard icon={<Database />} title="TOTAL INSTANCES" value={summary.instances} label={`Over ${summary.servers || 0} nodes`} color="#3b82f6" />
        <KpiCard icon={<CheckCircle />} title="HEALTHY STATUS" value={summary.healthy} label="Responding perfectly" color="#10b981" />
        <KpiCard icon={<Cpu />} title="MEMORY UTILIZATION" value={summary.memory_used} label="Total active memory" color="#8b5cf6" />
        <KpiCard icon={<Key />} title="KEYSPACE VOLUME" value={summary.keys > 1000 ? (summary.keys/1000).toFixed(1) + 'K' : summary.keys || 0} label="Tracked objects" color="#f59e0b" />
        <KpiCard icon={<Users />} title="ACTIVE CLIENTS" value={summary.clients} label="Current connections" color="#0ea5e9" />
        <KpiCard icon={<Activity />} title="THROUGHPUT (OPS/S)" value={summary.ops_sec} label="Instantaneous rate" color="#ec4899" />
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 500 }}>
        {/* INVENTORY LIST */}
        <div style={{ 
          flex: selectedInstance ? "0 0 65%" : "1",
          transition: "flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          background: "rgba(17, 24, 39, 0.6)", border: "1px solid var(--border)", borderRadius: 12, 
          display: "flex", flexDirection: "column", overflow: "hidden", backdropFilter: "blur(8px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)"
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(22, 29, 46, 0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Layers size={18} color="var(--color-info)" />
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Global Redis Inventory</span>
              <div style={{ fontSize: 12, color: "var(--color-info)", background: "rgba(59, 130, 246, 0.1)", padding: "2px 8px", borderRadius: 12, border: "1px solid rgba(59, 130, 246, 0.2)", fontWeight: 600 }}>
                {summary.instances || 0} LIVE
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  placeholder="Search instances, containers..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ 
                    background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 6, 
                    padding: "8px 12px 8px 32px", fontSize: 13, width: 280, color: "var(--text-primary)",
                    transition: "all 0.2s", outline: "none"
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "var(--color-info)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}
                />
                <Database size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
              </div>
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead style={{ background: "rgba(22, 29, 46, 0.8)", position: "sticky", top: 0, zIndex: 1, backdropFilter: "blur(4px)" }}>
                <tr>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Server</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Container</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Role</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Memory</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Keys</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Clients</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Ops/s</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((row: any) => {
                  const isSelected = selectedInstanceId === row.id;
                  let statusColor = "var(--color-healthy)";
                  if (row.status === "Warning") statusColor = "var(--color-warning)";
                  if (row.status === "Critical") statusColor = "var(--color-critical)";
                  if (row.status === "Unavailable" || row.status === "Stale") statusColor = "var(--color-muted)";

                  return (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedInstanceId(isSelected ? null : row.id)}
                      style={{ 
                        borderBottom: "1px solid var(--border)", cursor: "pointer",
                        background: isSelected ? "var(--bg-active)" : "transparent",
                        transition: "all 0.2s ease"
                      }}
                      className="hover:bg-opacity-50 hover:bg-gray-800"
                    >
                      <td style={{ padding: "14px 16px", color: "var(--text-secondary)" }}>{row.server_name}</td>
                      <td style={{ padding: "14px 16px", color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                        {row.container_name}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ 
                          padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: row.role === "Primary" ? "rgba(59, 130, 246, 0.15)" : row.role === "Replica" ? "rgba(16, 185, 129, 0.15)" : "rgba(107, 114, 128, 0.15)",
                          color: row.role === "Primary" ? "#3b82f6" : row.role === "Replica" ? "#10b981" : "#9ca3af"
                        }}>
                          {row.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-primary)", fontWeight: 500 }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{row.memory_used_human}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ {row.max_memory_human}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-primary)" }}>{row.keys > 1000 ? (row.keys/1000).toFixed(1) + 'K' : row.keys}</td>
                      <td style={{ padding: "14px 16px", color: "var(--text-primary)" }}>{row.clients}</td>
                      <td style={{ padding: "14px 16px", color: "var(--color-info)", fontWeight: 600 }}>{row.ops_sec}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: statusColor, fontWeight: 600, fontSize: 13 }}>
                          <div style={{ 
                            width: 8, height: 8, borderRadius: "50%", background: statusColor,
                            boxShadow: `0 0 8px ${statusColor}`,
                            animation: row.status === "Healthy" ? "pulse 2s infinite" : "none"
                          }}></div>
                          {row.status}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {instances.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "40px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--text-muted)" }}>
                        <Info size={32} />
                        <p style={{ fontSize: 15 }}>No instances found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--text-secondary)", background: "rgba(22, 29, 46, 0.5)" }}>
            <div>Showing {(pagination.page - 1) * pageSize + (instances.length > 0 ? 1 : 0)} - {Math.min(pagination.page * pageSize, summary.instances || 0)} of {summary.instances || 0} nodes</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: 6, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}
                ><ChevronLeft size={16} /></button>
                <span style={{ padding: "4px 12px", background: "var(--bg-active)", borderRadius: 6, color: "var(--text-primary)", fontWeight: 600 }}>{page}</span>
                <button 
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage(p => p + 1)}
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: 6, cursor: page >= pagination.total_pages ? "not-allowed" : "pointer", opacity: page >= pagination.total_pages ? 0.5 : 1 }}
                ><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* SELECTED DETAILS PANEL */}
        {selectedInstance && (
          <div style={{ 
            flex: "1", background: "rgba(17, 24, 39, 0.8)", border: "1px solid var(--border-active)", 
            borderRadius: 12, display: "flex", flexDirection: "column", backdropFilter: "blur(12px)",
            boxShadow: "0 8px 40px rgba(59, 130, 246, 0.15)",
            animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            height: "100%", overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(59, 130, 246, 0.05)", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(59, 130, 246, 0.2)", padding: 6, borderRadius: 8 }}>
                  <ServerIcon size={18} color="var(--color-info)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{selectedInstance.container_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Network size={12} /> {selectedInstance.server_name}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInstanceId(null)}
                style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "var(--text-muted)", padding: 6, borderRadius: "50%", cursor: "pointer", transition: "all 0.2s" }}
                onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              ><X size={18} /></button>
            </div>
            
            <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetricBox label="Redis Engine" value={selectedInstance.version} />
                <MetricBox label="Instance Role" value={selectedInstance.role} />
                <MetricBox label="Uptime" value={selectedInstance.uptime} />
                <MetricBox label="Active Clients" value={selectedInstance.clients} />
              </div>

              {/* Memory Usage Component */}
              <div style={{ background: "rgba(22, 29, 46, 0.6)", borderRadius: 12, padding: 16, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><HardDrive size={18} color="var(--color-purple)" /> Memory Diagnostics</span>
                  <span style={{ color: "var(--color-purple)" }}>{selectedInstance.memory_used_human} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>/ {selectedInstance.max_memory_human}</span></span>
                </div>
                <div style={{ width: "100%", height: 12, background: "rgba(0,0,0,0.3)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ 
                    width: `${selectedInstance.max_memory > 0 ? Math.min(100, (selectedInstance.memory_used / selectedInstance.max_memory)*100) : 5}%`, 
                    height: "100%", 
                    background: "linear-gradient(90deg, #8b5cf6 0%, #c084fc 100%)",
                    borderRadius: 6, boxShadow: "0 0 10px rgba(139, 92, 246, 0.6)"
                  }} />
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  <DetailItem label="Peak Memory" value={selectedInstance.peak_memory_human} />
                  <DetailItem label="Eviction Policy" value={selectedInstance.maxmemory_policy} />
                  <DetailItem label="Fragmentation Ratio" value={selectedInstance.fragmentation_ratio} />
                  <DetailItem label="Evicted Keys" value={selectedInstance.evicted_keys} />
                  <DetailItem label="Expired Keys (Total)" value={selectedInstance.expired_keys} />
                  <DetailItem label="Keys Pending Expiry" value={selectedInstance.expiring_keys} />
                </div>
              </div>

              {/* Operations & Throughput */}
              <div style={{ background: "rgba(22, 29, 46, 0.6)", borderRadius: 12, padding: 16, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Zap size={18} color="var(--color-info)" /> Throughput & Keyspace</span>
                  <span style={{ color: "var(--color-info)", display: "flex", alignItems: "center", gap: 6 }}>
                    {selectedInstance.ops_sec} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>OPS/SEC</span>
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <DetailItem label="Cache Hit Ratio" value={selectedInstance.hit_ratio} highlight />
                    <DetailItem label="Total Keys" value={selectedInstance.keys} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <DetailItem label="Keyspace Hits" value={selectedInstance.keyspace_hits} />
                    <DetailItem label="Keyspace Misses" value={selectedInstance.keyspace_misses} />
                  </div>
                </div>
              </div>

              {/* Persistence & Replication */}
              <div style={{ background: "rgba(22, 29, 46, 0.6)", borderRadius: 12, padding: 16, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Save size={18} color="var(--color-healthy)" /> Data Persistence</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <DetailItem label="AOF Enabled" value={selectedInstance.aof_enabled} />
                  <DetailItem label="Last RDB Save" value={selectedInstance.last_rdb_save?.split('T')[0] || "Unknown"} />
                  <DetailItem label="Replication Topo" value={selectedInstance.replication} />
                  <DetailItem label="Replica Count" value={selectedInstance.replica_count} />
                  <DetailItem label="Blocked Clients" value={selectedInstance.blocked_clients} />
                </div>
              </div>

              {/* Docker/Connection Config */}
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 16, border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  <Settings size={14} color="var(--text-muted)" /> Connection Configuration
                </h4>
                <pre style={{ margin: 0, fontSize: 12, color: "#10b981", fontFamily: "JetBrains Mono, monospace", background: "#06090e", padding: 12, borderRadius: 6, border: "1px solid #1a2235", overflowX: "auto", whiteSpace: "pre-wrap" }}>
{`Network Mode:  ${selectedInstance.docker_network}
Port Binding:  ${selectedInstance.port} -> ${selectedInstance.bind}
Docker State:  ${selectedInstance.container_state}
Base Image:    ${selectedInstance.image}`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RECENT EVENTS / ERRORS SECTION */}
      <div style={{ background: "rgba(17, 24, 39, 0.6)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, backdropFilter: "blur(8px)", marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={18} color="var(--color-info)" />
            <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Recent Redis Events & Diagnostics</span>
          </div>
        </div>
        <div style={{ overflow: "auto", maxHeight: 300 }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ background: "rgba(22, 29, 46, 0.8)", position: "sticky", top: 0 }}>
              <tr>
                <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Time</th>
                <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Instance</th>
                <th style={{ padding: "10px 16px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Event Detail</th>
              </tr>
            </thead>
            <tbody>
              {data?.events?.map((e: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }} className="hover:bg-gray-800 hover:bg-opacity-40">
                  <td style={{ padding: "10px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(e.time).toLocaleTimeString()}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontWeight: 500 }}>{e.instance}</td>
                  <td style={{ padding: "10px 16px", color: e.event.toLowerCase().includes("fail") || e.event.toLowerCase().includes("error") ? "var(--color-critical)" : "var(--color-healthy)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.event.toLowerCase().includes("fail") || e.event.toLowerCase().includes("error") ? "var(--color-critical)" : "var(--color-healthy)" }} />
                      {e.event}
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.events || data.events.length === 0) && (
                <tr>
                  <td colSpan={3} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>No recent events or errors recorded in the system.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* GLOBAL KEYFRAMES */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes countdown {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 63; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}} />
    </div>
  );
}

// ----------------------
// HELPER COMPONENTS
// ----------------------

function KpiCard({ icon, title, value, label, color }: { icon: React.ReactNode, title: string, value: string | number, label: string, color: string }) {
  return (
    <div style={{ 
      background: "rgba(17, 24, 39, 0.7)", border: "1px solid var(--border)", borderRadius: 12, 
      padding: 16, display: "flex", flexDirection: "column", gap: 10, backdropFilter: "blur(10px)",
      boxShadow: "0 4px 15px rgba(0,0,0,0.1)", transition: "transform 0.2s ease, box-shadow 0.2s ease",
      cursor: "default", height: "100%", flex: 1
    }}
    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 8px 25px ${color}20`; }}
    onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function DetailItem({ label, value, highlight = false }: { label: string, value: React.ReactNode, highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: highlight ? 700 : 600, color: highlight ? "var(--color-info)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
