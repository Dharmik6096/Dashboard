"use client";
import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import api from "@/lib/api";
import { formatLastSeen } from "@/lib/formatters";
import {
  HardDrive, Server as ServerIcon, AlertTriangle, RefreshCw,
  Folder, File, BarChart3, Database, Layers, LayoutGrid,
  Activity, ArrowRight, Search, Zap, List
} from "lucide-react";
import { TimeSeriesChart } from "@/components/ui/charts";
import { PageTransition } from "@/components/ui/PageTransition";

const safeFormatBytes = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface StorageData {
  summary: {
    reporting_servers: number;
    total_servers: number;
    mounted_filesystems: number;
    used_capacity: number;
    total_capacity: number;
    free_capacity: number;
    disk_alerts: number;
    hot_volumes: number;
  };
  capacity_trend: any[];
  filesystem_health: any[];
  top_consumers: any[];
  explorer: any[];
  fastest_growth: any[];
  recent_alerts: any[];
}

const StorageTreeNode = ({
  path,
  type = "directory",
  sizeBytes,
  usePercent,
  serverFilter,
  onNavigate,
  level = 0,
  defaultExpanded = false
}: {
  path: string,
  type?: string,
  sizeBytes: number | null,
  usePercent: number,
  serverFilter: string,
  onNavigate: (p: string) => void,
  level?: number,
  defaultExpanded?: boolean
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const folderName = path.split('/').filter(Boolean).pop() || path;

  const fetchNode = async () => {
    try {
      const res = await api.get(`/storage/consumers?server_id=${serverFilter}&filesystem=${encodeURIComponent(path)}`);
      setChildren(res.data.top_consumers || []);
      setUpdatedAt(res.data.updated_at);
      setRefreshing(res.data.refreshing || false);
      setLoading(false);
      
      if (res.data.refreshing) {
        setTimeout(() => fetchNode(), 3000);
      }
    } catch (err) {
      setError(true);
      setLoading(false);
    }
  };

  const toggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type !== "directory") return;
    
    if (!expanded && children.length === 0) {
      setLoading(true);
      setError(false);
      fetchNode();
    }
    setExpanded(!expanded);
  };



  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 8px",
          paddingLeft: `${level * 16 + 8}px`,
          cursor: "pointer",
          borderRadius: "4px",
          transition: "background 0.2s"
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        onClick={toggleExpand}
      >
        <div style={{ width: "20px", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "4px", color: "var(--text-muted)" }}>
          {loading ? <RefreshCw size={12} className="spin" /> :
            type === "directory" ? ((children.length > 0 || !expanded) ? (expanded ? "▼" : "▶") : "•") : ""}
        </div>
        {type === "directory" ? (
          <Folder size={14} color="var(--color-blue)" style={{ marginRight: "8px" }} />
        ) : (
          <File size={14} color="var(--text-muted)" style={{ marginRight: "8px" }} />
        )}
        <span
          style={{ flexGrow: 1, fontSize: "13px", fontFamily: "var(--font-mono)", color: "var(--text-primary)", cursor: "pointer", textDecoration: "none" }}
          onClick={(e) => { e.stopPropagation(); onNavigate(path); }}
          onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
          title="Click to explore"
        >
          {folderName}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px", justifyContent: "flex-end" }}>
          {sizeBytes === null ? (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>Calculating...</span>
          ) : (
            <>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{safeFormatBytes(sizeBytes)}</span>
              <div style={{ width: "40px", height: "4px", background: "var(--bg-input)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${usePercent}%`, height: "100%", background: usePercent > 50 ? "var(--color-warning)" : "var(--color-blue)" }} />
              </div>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {error && <div style={{ paddingLeft: `${(level + 1) * 16 + 32}px`, fontSize: "11px", color: "var(--color-danger)" }}>Failed to load directory</div>}
          
          {updatedAt && !loading && (
            <div style={{ paddingLeft: `${(level + 1) * 16 + 32}px`, fontSize: "10px", color: "var(--text-muted)", margin: "4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              Last scanned: {new Date(updatedAt * 1000).toLocaleTimeString()}
              {refreshing && <span style={{ color: "var(--color-blue)", display: "flex", alignItems: "center", gap: "4px" }}><RefreshCw size={8} className="spin" /> Refreshing...</span>}
            </div>
          )}

          {!loading && children.length === 0 && expanded && !error && (
            <div style={{ paddingLeft: `${(level + 1) * 16 + 32}px`, fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>Empty directory</div>
          )}
          {children.map((c, i) => (
            <StorageTreeNode
              key={i}
              path={c.path}
              type={c.type}
              sizeBytes={c.size_bytes}
              usePercent={c.use_percent}
              serverFilter={serverFilter}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
import { useFilter } from "@/lib/FilterContext";

export default function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const { envFilter, setEnvFilter, serverFilter, setServerFilter, environments: ctxEnv, servers: ctxServers } = useFilter();
  const [fsFilter, setFsFilter] = useState("all");
  const [period, setPeriod] = useState("1h");

  const [servers, setServers] = useState<{ id: string; name: string; environment: string }[]>([]);
  const [topConsumers, setTopConsumers] = useState<any[]>([]);
  const [consumersLoading, setConsumersLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const lastFsRef = useRef<string | null>(null);

  useEffect(() => {
    api.get("/servers").then(res => {
      const srvs = Array.isArray(res.data) ? res.data : [];
      setServers(srvs);
    }).catch(() => { });
  }, []);

  const environments = Array.from(new Map(
    servers.filter(s => s.environment).map(s => [s.environment.toLowerCase(), s.environment])
  ).values()).sort();

  const filteredServers = envFilter === "all"
    ? servers
    : servers.filter(s => (s.environment || "").toLowerCase() === envFilter.toLowerCase());

  const mountedFilesystems = data
    ? Array.from(new Set(data.filesystem_health.map((r: any) => r.mount_path).filter(Boolean)))
    : [];

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await api.get(`/storage/dashboard?period=${period}&environment=${envFilter}&server_id=${serverFilter}&filesystem=${encodeURIComponent(fsFilter)}`);
      const raw = res.data || {};
      const safe: StorageData = {
        summary: {
          reporting_servers: raw.summary?.reporting_servers ?? 0,
          total_servers: raw.summary?.total_servers ?? 0,
          mounted_filesystems: raw.summary?.mounted_filesystems ?? 0,
          used_capacity: raw.summary?.used_capacity ?? 0,
          total_capacity: raw.summary?.total_capacity ?? 0,
          free_capacity: raw.summary?.free_capacity ?? 0,
          disk_alerts: raw.summary?.disk_alerts ?? 0,
          hot_volumes: raw.summary?.hot_volumes ?? 0,
        },
        capacity_trend: Array.isArray(raw.capacity_trend) ? raw.capacity_trend : [],
        filesystem_health: Array.isArray(raw.filesystem_health) ? raw.filesystem_health : [],
        top_consumers: [],
        explorer: Array.isArray(raw.explorer) ? raw.explorer : [],
        fastest_growth: Array.isArray(raw.fastest_growth) ? raw.fastest_growth : [],
        recent_alerts: Array.isArray(raw.recent_alerts) ? raw.recent_alerts : [],
      };
      setData(safe);
      setError(null);

      if (serverFilter !== 'all') {
        const isNewPath = lastFsRef.current !== fsFilter;

        // Only fetch the heavy disk analyzer tree if the path changed or the user manually clicked refresh.
        // Ignore background auto-refreshes to preserve the tree's expanded state.
        if (isNewPath || isManualRefresh || topConsumers.length === 0) {
          if (isNewPath || topConsumers.length === 0) {
            setConsumersLoading(true);
            setTopConsumers([]);
          }
          lastFsRef.current = fsFilter;
          const fetchRootConsumers = () => {
            api.get(`/storage/consumers?server_id=${serverFilter}&filesystem=${encodeURIComponent(fsFilter)}`)
              .then(res => {
                setTopConsumers(res.data.top_consumers || []);
                if (res.data.refreshing) {
                  setTimeout(fetchRootConsumers, 3000);
                }
              })
              .catch(() => setTopConsumers([]))
              .finally(() => setConsumersLoading(false));
          };
          fetchRootConsumers();
        }
      } else {
        setTopConsumers([]);
        lastFsRef.current = null;
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to load storage data");
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, [envFilter, serverFilter, fsFilter, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRowClick = (serverId: string, mountPath: string) => {
    setServerFilter(serverId);
    setFsFilter(mountPath);
    setActiveTab("explorer");
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'filesystems', label: 'Filesystems', icon: Database },
    { id: 'explorer', label: 'Explorer', icon: Folder },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  ];

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>

        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-end", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
              <div style={{ padding: "8px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "12px", display: "flex" }}>
                <HardDrive size={28} color="var(--color-blue)" />
              </div>
              Storage Intelligence
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "14px", maxWidth: "700px", lineHeight: "1.5" }}>
              Enterprise-grade disk capacity monitoring, advanced filesystem health analytics, and deep directory exploration across your entire infrastructure.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", background: "var(--bg-card)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              {['5m', '15m', '1h', '6h', '24h'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "6px 12px", fontSize: "12px", fontWeight: 500, borderRadius: "6px", cursor: "pointer", outline: "none",
                    background: period === p ? "var(--color-blue)" : "transparent",
                    color: period === p ? "#fff" : "var(--text-secondary)",
                    border: "none", transition: "all 0.2s"
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-primary)",
                fontSize: "14px", fontWeight: 500, cursor: isRefreshing ? "default" : "pointer", outline: "none",
                transition: "all 0.2s"
              }}
            >
              <RefreshCw size={14} color="var(--color-blue)" style={isRefreshing ? { animation: "spin 1s linear infinite" } : {}} />
              Refresh
            </button>
          </div>
        </div>

        {/* Unified Filter Bar */}
        <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>
            <Search size={16} /> Scope:
          </div>
          <select
            value={envFilter}
            onChange={e => { setEnvFilter(e.target.value); setServerFilter("all"); }}
            style={selectStyle}
          >
            <option value="all">All Environments</option>
            {environments.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          <ArrowRight size={14} color="var(--text-muted)" />

          <select
            value={serverFilter}
            onChange={e => setServerFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Servers</option>
            {filteredServers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <ArrowRight size={14} color="var(--text-muted)" />

          <select
            value={fsFilter}
            onChange={e => setFsFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Filesystems</option>
            {mountedFilesystems.map((mp: string) => <option key={mp} value={mp}>{mp}</option>)}
          </select>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", gap: "24px" }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px", paddingBottom: "12px", paddingLeft: "8px", paddingRight: "8px",
                  fontSize: "14px", fontWeight: 500, background: "none", border: "none", cursor: "pointer", outline: "none",
                  color: isActive ? "var(--color-blue)" : "var(--text-secondary)", transition: "color 0.2s", position: "relative"
                }}
              >
                <Icon size={16} />
                {tab.label}
                {isActive && (
                  <div style={{ position: "absolute", bottom: "-1px", left: 0, width: "100%", height: "2px", background: "var(--color-blue)", borderRadius: "2px 2px 0 0", boxShadow: "0 0 8px var(--color-blue)" }} />
                )}
              </button>
            );
          })}
        </div>

        {loading && !data ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px", gap: "16px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid rgba(59, 130, 246, 0.2)", borderTopColor: "var(--color-blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Analyzing storage infrastructure...</span>
          </div>
        ) : null}

        {error ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--color-critical)", borderRadius: "12px" }}>
            <AlertTriangle size={20} />
            <span style={{ fontWeight: 500 }}>{error}</span>
          </div>
        ) : null}

        {data && !loading && (
          <div style={{ animation: "fadeIn 0.5s ease-out" }}>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Metrics Grid */}
                <div className="metric-grid">
                  <PremiumMetricCard title="Active Servers" value={`${data.summary.reporting_servers}`} total={`/ ${data.summary.total_servers}`} icon={ServerIcon} color="var(--color-blue)" trend="Reporting Data" />
                  <PremiumMetricCard title="Mounted FS" value={data.summary.mounted_filesystems} icon={Database} color="var(--color-purple)" trend="Across Scopes" />
                  <PremiumMetricCard title="Used Storage" value={safeFormatBytes(data.summary.used_capacity)} icon={HardDrive} color="var(--color-indigo)" trend={`Total: ${safeFormatBytes(data.summary.total_capacity)}`} />
                  <PremiumMetricCard title="Free Storage" value={safeFormatBytes(data.summary.free_capacity)} icon={Layers} color="var(--color-healthy)" trend={`${data.summary.total_capacity > 0 ? Math.round((data.summary.free_capacity / data.summary.total_capacity) * 100) : 0}% Available`} />
                  <PremiumMetricCard title="Critical Alerts" value={data.summary.disk_alerts} icon={AlertTriangle} color={data.summary.disk_alerts > 0 ? "var(--color-critical)" : "var(--color-healthy)"} trend="Require Attention" />
                  <PremiumMetricCard title="Hot Volumes" value={data.summary.hot_volumes} icon={Activity} color={data.summary.hot_volumes > 0 ? "var(--color-warning)" : "var(--color-healthy)"} trend=">85% Utilization" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
                  {/* Capacity Trend Chart */}
                  <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gridColumn: "span 2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                      <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                          <Activity size={18} color="var(--color-blue)" /> Global Capacity Trend
                        </h3>
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Aggregated used vs free capacity over time</p>
                      </div>
                    </div>
                    <div style={{ height: "300px", flexGrow: 1 }}>
                      {data.capacity_trend && data.capacity_trend.length > 0 ? (
                        <TimeSeriesChart
                          data={data.capacity_trend}
                          title="Global Capacity Trend"
                          formatValue={safeFormatBytes}
                          yAxisWidth={90}
                          series={[
                            { key: 'used', color: 'var(--color-blue)', name: 'Used Capacity (Bytes)' },
                            { key: 'free', color: 'var(--color-healthy)', name: 'Free Capacity (Bytes)' }
                          ]}
                        />
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", border: "2px dashed var(--border-subtle)", borderRadius: "8px" }}>
                          Insufficient historical capacity data
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Consumers Preview */}
                  <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                          <BarChart3 size={18} color="var(--color-warning)" /> Top Consumers
                        </h3>
                      </div>
                      <button onClick={() => setActiveTab('explorer')} style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-blue)", display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        View All <ArrowRight size={12} />
                      </button>
                    </div>

                    {serverFilter === 'all' || fsFilter === 'all' ? (
                      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", border: "2px dashed var(--border-subtle)", borderRadius: "8px", background: "rgba(0,0,0,0.02)" }}>
                        <List size={32} color="var(--text-muted)" style={{ marginBottom: "12px" }} />
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Select Specific Scope</p>
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Filter by a single server and filesystem to reveal top disk consumers.</p>
                      </div>
                    ) : consumersLoading ? (
                      <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "8px" }}>
                        <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Scanning top consumers...
                      </div>
                    ) : (
                      <div style={{ flexGrow: 1, overflowY: "auto", paddingRight: "8px" }}>
                        {topConsumers.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {topConsumers.map((row, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", borderRadius: "8px", background: "var(--bg-body)", border: "1px solid var(--border-subtle)", transition: "border-color 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
                                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.1)", color: "var(--color-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>
                                    {row.rank}
                                  </div>
                                  <div style={{ overflow: "hidden" }}>
                                    <p style={{ fontSize: "14px", fontFamily: "var(--font-mono)", color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "6px" }} title={row.path}>
                                      {row.type === "directory" ? <Folder size={12} color="var(--color-blue)" /> : <File size={12} color="var(--text-muted)" />}
                                      {row.path}
                                    </p>
                                    {row.size_bytes === null ? (
                                      <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>Calculating...</p>
                                    ) : (
                                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>{safeFormatBytes(row.size_bytes)}</p>
                                    )}
                                  </div>
                                </div>
                                <div style={{ flexShrink: 0, textAlign: "right" }}>
                                  {row.size_bytes !== null && (
                                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{row.use_percent}%</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>No data available. Ensure agent/SSH access.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FILESYSTEMS TAB */}
            {activeTab === 'filesystems' && (
              <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <Database size={20} color="var(--color-purple)" />
                    Filesystem Fleet Health
                    <span style={{ padding: "2px 8px", borderRadius: "99px", background: "rgba(168, 85, 247, 0.1)", color: "var(--color-purple)", fontSize: "12px", fontWeight: 500, marginLeft: "8px" }}>
                      {data.filesystem_health.length} Mounts
                    </span>
                  </h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Server</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Mount Path</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Type</th>
                        <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>Total</th>
                        <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>Used</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Utilization</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Inodes</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Status</th>
                        <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>Last Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.filesystem_health.length > 0 ? data.filesystem_health.map((row, i) => {
                        const isSelected = serverFilter === row.server_id && fsFilter === row.mount_path;
                        return (
                          <tr
                            key={`${row.server_id}-${row.mount_path}-${i}`}
                            onClick={() => handleRowClick(row.server_id, row.mount_path)}
                            style={{
                              cursor: "pointer",
                              background: isSelected ? "rgba(59, 130, 246, 0.05)" : "transparent",
                              borderLeft: isSelected ? "3px solid var(--color-blue)" : "3px solid transparent",
                              transition: "background 0.2s"
                            }}
                          >
                            <td style={{ padding: "16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, color: "var(--text-primary)" }}>
                                <ServerIcon size={14} color="var(--color-blue)" />
                                {row.server_name}
                              </div>
                            </td>
                            <td style={{ padding: "16px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{row.mount_path}</td>
                            <td style={{ padding: "16px", color: "var(--text-secondary)" }}>{row.filesystem}</td>
                            <td style={{ padding: "16px", textAlign: "right", fontWeight: 500 }}>{safeFormatBytes(row.total)}</td>
                            <td style={{ padding: "16px", textAlign: "right", color: "var(--text-secondary)" }}>{safeFormatBytes(row.used)}</td>
                            <td style={{ padding: "16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ width: "32px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{Math.round(row.use_percent)}%</span>
                                <div style={{ height: "8px", width: "96px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                                  <div
                                    style={{
                                      height: "100%", borderRadius: "4px", transition: "width 1s",
                                      background: row.use_percent > 90 ? "var(--color-critical)" : row.use_percent > 80 ? "var(--color-warning)" : "var(--color-healthy)",
                                      boxShadow: row.use_percent > 90 ? "0 0 8px var(--color-critical)" : "none",
                                      width: `${Math.min(100, row.use_percent)}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ width: "32px", textAlign: "right", color: "var(--text-secondary)" }}>{Math.round(row.inodes_percent || 0)}%</span>
                                <div style={{ height: "6px", width: "64px", background: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                                  <div
                                    style={{
                                      height: "100%", borderRadius: "3px", transition: "width 0.5s",
                                      background: (row.inodes_percent || 0) > 90 ? "var(--color-critical)" : (row.inodes_percent || 0) > 80 ? "var(--color-warning)" : "var(--color-blue)",
                                      width: `${Math.min(100, row.inodes_percent || 0)}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "16px" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                                background: row.status === 'Healthy' ? "rgba(16, 185, 129, 0.1)" : row.status === 'Warning' ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
                                color: row.status === 'Healthy' ? "var(--color-healthy)" : row.status === 'Warning' ? "var(--color-warning)" : "var(--color-critical)",
                                border: `1px solid ${row.status === 'Healthy' ? "rgba(16, 185, 129, 0.2)" : row.status === 'Warning' ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)"}`
                              }}>
                                {row.status === 'Healthy' && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-healthy)", marginRight: "6px", animation: "pulse 2s infinite" }} />}
                                {row.status || "Unknown"}
                              </span>
                            </td>
                            <td style={{ padding: "16px", textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>
                              {row.last_seen ? formatLastSeen(row.last_seen) : 'Never'}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={9} style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontWeight: 500 }}>No filesystems found for the current filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EXPLORER TAB */}
            {activeTab === 'explorer' && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "24px" }}>

                {/* Disk Usage Explorer (Main) */}
                <div className="card" style={{ gridColumn: "span 2", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
                      <Folder size={20} color="var(--color-blue)" style={{ flexShrink: 0 }} />

                      <div style={{ display: "flex", alignItems: "center", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none" }}>
                        {fsFilter.split('/').map((part, idx, arr) => {
                          if (idx === 0 && part === '') return null;

                          const isRoot = idx === 0 && part !== '';
                          let pathSoFar = '/';
                          if (part !== '') {
                            const subParts = arr.slice(0, idx + 1).filter(Boolean);
                            pathSoFar = '/' + subParts.join('/');
                          }

                          const isLast = idx === arr.length - 1 || (idx === 0 && arr.length === 2 && arr[1] === '');
                          const displayPart = (part === '' && idx === 0) ? '/' : part;

                          return (
                            <Fragment key={idx}>
                              {idx > 1 && <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>/</span>}
                              {(idx === 1 && arr[0] !== '') && <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>/</span>}

                              <span
                                onClick={() => { if (!isLast) setFsFilter(pathSoFar); }}
                                style={{
                                  cursor: isLast ? "default" : "pointer",
                                  color: isLast ? "var(--text-primary)" : "var(--color-blue)",
                                  transition: "opacity 0.2s",
                                  opacity: isLast ? 1 : 0.8
                                }}
                                onMouseOver={(e) => { if (!isLast) e.currentTarget.style.opacity = '1'; e.currentTarget.style.textDecoration = isLast ? 'none' : 'underline'; }}
                                onMouseOut={(e) => { if (!isLast) e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.textDecoration = 'none'; }}
                              >
                                {displayPart}
                              </span>
                            </Fragment>
                          );
                        })}
                      </div>

                      {fsFilter !== 'all' && fsFilter !== '/' && (
                        <button
                          onClick={() => {
                            const parts = fsFilter.split('/').filter(Boolean);
                            parts.pop();
                            setFsFilter('/' + parts.join('/'));
                          }}
                          style={{ marginLeft: "12px", padding: "6px 12px", fontSize: "12px", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "6px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
                        >
                          ← Go Back
                        </button>
                      )}
                    </div>
                    <span style={{ padding: "4px 8px", background: "rgba(245, 158, 11, 0.1)", color: "var(--color-warning)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "4px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                      Live Read-Only
                    </span>
                  </div>

                  {serverFilter === 'all' || fsFilter === 'all' ? (
                    <div style={{ padding: "80px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <Search size={48} color="var(--text-muted)" style={{ marginBottom: "16px" }} />
                      <h4 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Select a Scope to Explore</h4>
                      <p style={{ color: "var(--text-secondary)", marginTop: "8px", maxWidth: "400px" }}>
                        Please use the <strong>Server</strong> and <strong>Filesystem</strong> dropdown menus at the top of the page, or browse the filesystems table to fetch live directory contents via SSH.
                      </p>
                      <button
                        onClick={() => setActiveTab('filesystems')}
                        style={{ marginTop: "24px", padding: "8px 16px", background: "var(--color-blue)", color: "#fff", borderRadius: "8px", fontWeight: 500, border: "none", cursor: "pointer" }}
                      >
                        Browse Filesystems
                      </button>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", flexGrow: 1 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ padding: "16px", fontWeight: 600 }}>Name</th>
                            <th style={{ padding: "16px", fontWeight: 600 }}>Type</th>
                            <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>Size</th>
                            <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>Last Modified</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fsFilter !== 'all' && fsFilter !== '/' && (
                            <tr
                              onClick={() => {
                                const parts = fsFilter.split('/').filter(Boolean);
                                parts.pop();
                                setFsFilter('/' + parts.join('/'));
                              }}
                              style={{ cursor: "pointer", transition: "background 0.2s" }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: "16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontFamily: "var(--font-mono)", color: "var(--color-blue)" }}>
                                  <Folder size={16} color="var(--color-blue)" />
                                  ..
                                </div>
                              </td>
                              <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                                <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", background: "rgba(59, 130, 246, 0.1)", color: "var(--color-blue)" }}>
                                  Folder
                                </span>
                              </td>
                              <td style={{ padding: "16px", textAlign: "right", fontWeight: 500 }}>--</td>
                              <td style={{ padding: "16px", textAlign: "right", color: "var(--text-muted)" }}>--</td>
                            </tr>
                          )}
                          {data.explorer.length > 0 ? data.explorer.map((row, i) => {
                            let displaySize = safeFormatBytes(row.size);
                            if (row.type === 'Folder') {
                              const fullPath = fsFilter.endsWith('/') ? `${fsFilter}${row.name}` : `${fsFilter}/${row.name}`;
                              const consumerMatch = topConsumers.find((c: any) => c.path === fullPath);
                              if (consumerMatch) {
                                displaySize = consumerMatch.size_bytes === null ? "Calculating..." : safeFormatBytes(consumerMatch.size_bytes);
                              } else {
                                displaySize = "--";
                              }
                            }

                            return (
                              <tr
                                key={i}
                                onClick={() => {
                                  if (row.type === 'Folder') {
                                    const newPath = fsFilter.endsWith('/') ? `${fsFilter}${row.name}` : `${fsFilter}/${row.name}`;
                                    setFsFilter(newPath);
                                  }
                                }}
                                style={{ cursor: row.type === 'Folder' ? 'pointer' : 'default', transition: "background 0.2s" }}
                                onMouseOver={(e) => { if (row.type === 'Folder') e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)' }}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <td style={{ padding: "16px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontFamily: "var(--font-mono)", color: row.type === 'Folder' ? "var(--color-blue)" : "var(--text-primary)" }}>
                                    {row.type === 'Folder' ? (
                                      <Folder size={16} color="var(--color-blue)" />
                                    ) : (
                                      <File size={16} color="var(--text-muted)" />
                                    )}
                                    {row.name}
                                  </div>
                                </td>
                                <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                                  <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", background: row.type === 'Folder' ? "rgba(59, 130, 246, 0.1)" : "var(--bg-input)", color: row.type === 'Folder' ? "var(--color-blue)" : "var(--text-secondary)" }}>
                                    {row.type}
                                  </span>
                                </td>
                                <td style={{ padding: "16px", textAlign: "right", fontWeight: 500 }}>{displaySize}</td>
                                <td style={{ padding: "16px", textAlign: "right", color: "var(--text-muted)" }}>{row.modified}</td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan={4} style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>No data available or directory is empty.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Disk Space Analyzer Sidebar */}
                <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                      <Layers size={20} color="var(--color-warning)" />
                      Disk Space Analyzer
                    </h3>
                  </div>

                  {serverFilter === 'all' ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                      Waiting for server selection...
                    </div>
                  ) : consumersLoading ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <RefreshCw size={24} className="spin" color="var(--color-blue)" />
                      <span>Scanning directories...</span>
                    </div>
                  ) : (
                    <div style={{ padding: "16px", flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
                      {topConsumers.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)", fontSize: "12px" }}>
                            Interactive Usage Tree for <strong>{fsFilter === 'all' ? 'All Drives' : fsFilter}</strong>
                          </div>
                          {topConsumers.map((c, i) => (
                            <StorageTreeNode
                              key={i}
                              path={c.path}
                              type={c.type}
                              sizeBytes={c.size_bytes}
                              usePercent={c.use_percent}
                              serverFilter={serverFilter}
                              onNavigate={setFsFilter}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                          No analyzer data available.
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ALERTS TAB */}
            {activeTab === 'alerts' && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "20px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.02)" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={20} color="var(--color-critical)" />
                    Storage Incident History
                  </h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Time</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Server</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>Scope</th>
                        <th style={{ padding: "16px", fontWeight: 600, width: "50%" }}>Incident Detail</th>
                        <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_alerts.length > 0 ? data.recent_alerts.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: "16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{row.time ? formatLastSeen(row.time) : '-'}</td>
                          <td style={{ padding: "16px", fontWeight: 500, color: "var(--text-primary)" }}>{row.server_name}</td>
                          <td style={{ padding: "16px" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", background: "var(--bg-body)", borderRadius: "4px", padding: "4px 8px", border: "1px solid var(--border-subtle)" }}>
                              {row.mount_path}
                            </span>
                          </td>
                          <td style={{ padding: "16px", color: "var(--text-primary)" }}>{row.message}</td>
                          <td style={{ padding: "16px", textAlign: "right" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                              background: (row.severity || '').toLowerCase() === 'critical' ? 'rgba(239, 68, 68, 0.1)' : (row.severity || '').toLowerCase() === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              color: (row.severity || '').toLowerCase() === 'critical' ? 'var(--color-critical)' : (row.severity || '').toLowerCase() === 'warning' ? 'var(--color-warning)' : 'var(--color-blue)',
                              border: `1px solid ${(row.severity || '').toLowerCase() === 'critical' ? 'rgba(239, 68, 68, 0.2)' : (row.severity || '').toLowerCase() === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                            }}>
                              {row.severity}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} style={{ padding: "64px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-healthy)", background: "rgba(16, 185, 129, 0.05)", padding: "24px", borderRadius: "16px", border: "1px solid rgba(16, 185, 129, 0.1)" }}>
                              <Activity size={32} style={{ marginBottom: "12px" }} />
                              <p style={{ fontWeight: 700, fontSize: "18px", margin: 0 }}>System Healthy</p>
                              <p style={{ fontSize: "14px", marginTop: "4px", opacity: 0.8 }}>No recent storage incidents detected.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// Sub-components
function PremiumMetricCard({ title, value, total, trend, icon: Icon, color }: any) {
  return (
    <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: "96px", height: "96px", borderBottomLeftRadius: "96px", opacity: 0.1, backgroundColor: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 10 }}>
        <div style={{ padding: "8px", borderRadius: "8px", backgroundColor: `${color}15`, color: color }}>
          <Icon size={20} />
        </div>
      </div>
      <div style={{ marginTop: "16px", position: "relative", zIndex: 10 }}>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", margin: "0 0 4px 0" }}>{title}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <h3 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</h3>
          {total && <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 500 }}>{total}</span>}
        </div>
      </div>
      <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 500, padding: "4px 8px", borderRadius: "4px", background: "var(--bg-body)", border: "1px solid var(--border-subtle)", display: "inline-block", color: "var(--text-secondary)", position: "relative", zIndex: 10, alignSelf: "flex-start" }}>
        {trend}
      </div>
    </div>
  );
}

const selectStyle = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  minWidth: "160px"
};
