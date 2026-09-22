"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { Globe, RefreshCw, AlertCircle, Server as ServerIcon, Network, FileText, Lock, Activity, ChevronLeft, ChevronRight, Search, ShieldAlert, Cpu, ArrowUpDown } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { EnvironmentSelect } from "@/components/ui/EnvironmentSelect";
import { TimeSeriesChart } from "@/components/ui/charts/TimeSeriesChart";
import { PageTransition } from "@/components/ui/PageTransition";

export default function NginxPage() {
  const [environment, setEnvironment] = useState("All Environments");
  const [serverFilter, setServerFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [upstreamFilter, setUpstreamFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("1h");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [selectedConfigSnippet, setSelectedConfigSnippet] = useState<string>("Loading configuration...");

  const buildParams = useCallback(() => {
    return {
      environment: environment === "All Environments" ? "all" : environment,
      server_id: serverFilter,
      site: siteFilter,
      upstream: upstreamFilter,
      period: timeRange,
      search,
      page,
      page_size: pageSize
    };
  }, [environment, serverFilter, siteFilter, upstreamFilter, timeRange, search, page, pageSize]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const params = buildParams();
      const res = await api.get("/nginx/dashboard", { params });
      setData(res.data);
      
      // Keep selection if exists
      if (selectedSite) {
        const stillExists = res.data.sites.find((s: any) => s.id === selectedSite.id);
        if (!stillExists) setSelectedSite(null);
      }
    } catch (err: any) {
      setError(err.message || "Unable to load Nginx monitoring data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildParams, selectedSite]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle row click
  const handleSiteClick = async (site: any) => {
    if (selectedSite?.id === site.id) {
      setSelectedSite(null);
      return;
    }
    setSelectedSite(site);
    setSelectedConfigSnippet("Loading configuration...");
    try {
      const res = await api.get(`/nginx/sites/${site.id}/config`);
      setSelectedConfigSnippet(res.data.snippet);
    } catch {
      setSelectedConfigSnippet("Configuration snippet unavailable.");
    }
  };

  // Reset pagination on search change
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Derived options for filters based on current data
  const serverOptions = useMemo(() => {
    if (!data) return [{ value: "all", label: "All Servers" }];
    const uniqueServers = new Map();
    data.sites.forEach((s: any) => uniqueServers.set(s.server_id, s.server_name));
    return [{ value: "all", label: "All Servers" }, ...Array.from(uniqueServers.entries()).map(([k, v]) => ({ value: k, label: v }))];
  }, [data]);

  const siteOptions = useMemo(() => {
    if (!data) return [{ value: "all", label: "All Sites" }];
    const uniqueSites = Array.from(new Set(data.sites.map((s: any) => s.domain))).filter(Boolean);
    return [{ value: "all", label: "All Sites" }, ...uniqueSites.map(s => ({ value: s as string, label: s as string }))];
  }, [data]);

  const upstreamOptions = useMemo(() => {
    if (!data) return [{ value: "all", label: "All Upstreams" }];
    return [{ value: "all", label: "All Upstreams" }, ...data.upstream_health.map((u: any) => ({ value: u.name, label: u.name }))];
  }, [data]);

  const summary = data?.summary || {};

  return (
    <PageTransition>
      <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 60 }}>
        
        {/* Header section with Glassmorphism */}
        <div className="glass-panel" style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderRadius: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 8, background: "rgba(16,185,129,0.1)", borderRadius: 10, color: "var(--color-green)", display: "flex" }}>
                <Globe size={24} />
              </div>
              Enterprise Nginx Edge
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
              Centralized visibility into virtual hosts, upstream health, edge traffic, and SSL certificate lifecycles across the entire server fleet.
            </p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                {["LIVE", "5m", "15m", "1h", "6h", "24h"].map(tr => (
                  <button
                    key={tr}
                    onClick={() => setTimeRange(tr)}
                    style={{
                      background: timeRange === tr ? "var(--color-blue)" : "transparent",
                      color: timeRange === tr ? "#fff" : "var(--text-secondary)",
                      border: "none", padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600,
                      transition: "all 0.2s"
                    }}
                  >
                    {tr === "LIVE" && <span style={{ color: timeRange === tr ? "#fff" : "var(--color-green)", marginRight: 4, animation: "pulse 2s infinite" }}>●</span>}
                    {tr}
                  </button>
                ))}
              </div>
              <button 
                className="premium-btn" 
                onClick={() => loadData(true)} 
                disabled={refreshing || loading}
                style={{ padding: "6px 16px", height: 32, display: "flex", alignItems: "center", gap: 8 }}
              >
                <RefreshCw size={14} className={refreshing ? "spin" : ""} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>10s</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "0 16px" }}>
          <EnvironmentSelect value={environment} onChange={setEnvironment} width={200} />
          <SearchableCombobox value={serverFilter} onChange={setServerFilter} options={serverOptions} placeholder="All Nginx Servers" width={220} />
          <SearchableCombobox value={siteFilter} onChange={setSiteFilter} options={siteOptions} placeholder="All Virtual Hosts" width={220} />
          <SearchableCombobox value={upstreamFilter} onChange={setUpstreamFilter} options={upstreamOptions} placeholder="All Upstreams" width={220} />
        </div>

        {error && !data && (
          <div style={{ color: "var(--color-critical)", padding: 24, background: "rgba(239,68,68,0.1)", borderRadius: 16, border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 20 }}>
            <ShieldAlert size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Connection Error</div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>{error}</div>
            </div>
            <button onClick={() => loadData(true)} className="premium-btn">Retry Connection</button>
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: "center", padding: 100, color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <RefreshCw size={48} style={{ animation: "spin 1s linear infinite", marginBottom: 24, opacity: 0.3 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Loading Edge Telemetry...</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>Aggregating Nginx configuration and metrics from the fleet.</div>
          </div>
        )}

        {data && (
          <>
            {/* 6 High-Impact Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16 }}>
              <SummaryCard icon={ServerIcon} title="NGINX SERVERS" value={summary.nginx_servers} label="Reporting online" glow="var(--color-blue)" />
              <SummaryCard icon={Globe} title="VIRTUAL HOSTS" value={summary.server_blocks} label="Total configurations" />
              <SummaryCard icon={Network} title="UPSTREAM HEALTH" value={summary.total_upstreams > 0 ? `${summary.healthy_upstreams} / ${summary.total_upstreams}` : "0"} label="Healthy targets" glow={summary.healthy_upstreams < summary.total_upstreams ? "var(--color-warning)" : "var(--color-healthy)"} valueColor={summary.healthy_upstreams < summary.total_upstreams ? "var(--color-warning)" : "var(--color-healthy)"} />
              <SummaryCard icon={Activity} title="LIVE REQ / SEC" value={summary.requests_per_second} label="Fleet aggregate" glow="var(--color-purple)" valueColor="var(--color-purple)" />
              <SummaryCard icon={AlertCircle} title="ACTIVE ERRORS" value={summary.error_alerts} label="Requires attention" valueColor={summary.error_alerts > 0 ? "var(--color-critical)" : "inherit"} glow={summary.error_alerts > 0 ? "var(--color-critical)" : undefined} />
              <SummaryCard icon={Lock} title="SSL EXPIRING" value={summary.ssl_expiring_soon} label="Within 30 days" valueColor={summary.ssl_expiring_soon > 0 ? "var(--color-warning)" : "inherit"} glow={summary.ssl_expiring_soon > 0 ? "var(--color-warning)" : undefined} />
            </div>

            {/* Live Traffic Chart */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", padding: 24, borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Activity size={18} color="var(--color-purple)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Edge Traffic History</h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", background: "rgba(0,0,0,0.2)", padding: "4px 10px", borderRadius: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-healthy)", animation: "pulse 2s infinite" }} />
                  Live Sync
                </div>
              </div>
              <div style={{ height: 250, width: "100%" }}>
                <TimeSeriesChart
                  data={data.traffic_history}
                  series={[
                    { key: "reqs", name: "Requests (req/s)", color: "var(--color-purple)", type: "area" },
                    { key: "errs", name: "Errors (req/s)", color: "var(--color-critical)", type: "line" }
                  ]}
                  title=""
                  height={250}
                  yAxisWidth={40}
                />
              </div>
            </div>

            {/* Main Content Layout */}
            <div style={{ display: "grid", gridTemplateColumns: selectedSite ? "minmax(0, 1fr) 400px" : "1fr", gap: 24, transition: "grid-template-columns 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              
              {/* Left Column: Inventory */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                <div className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 16 }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Virtual Host Inventory</h3>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: "4px 10px", borderRadius: 12, fontWeight: 600 }}>
                        {data?.site_pagination?.total || 0} configurations
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input
                        type="text"
                        placeholder="Search domains, upstreams..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input"
                        style={{ width: 280, height: 36, fontSize: 13, paddingLeft: 36, background: "rgba(255,255,255,0.03)" }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ overflowX: "auto", flex: 1 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(17,24,39,0.95)", backdropFilter: "blur(8px)" }}>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          {["DOMAIN / SERVER", "UPSTREAM", "REQ/S", "ERRORS", "TLS STATUS", "STATE", ""].map(h => (
                            <th key={h} style={{ padding: "16px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data?.sites?.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>No virtual hosts found.</td></tr>
                        ) : (
                          data?.sites?.map((site: any) => {
                            const isSelected = selectedSite?.id === site.id;
                            const isStale = site.status !== "Healthy";
                            return (
                              <tr 
                                key={site.id} 
                                onClick={() => handleSiteClick(site)}
                                className={`data-table-row ${isSelected ? 'selected' : ''}`}
                                style={{ opacity: isStale ? 0.6 : 1, borderBottom: "1px solid rgba(255,255,255,0.02)", cursor: "pointer" }}
                              >
                                <td style={{ padding: "16px 20px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{site.domain}</span>
                                      {site.all_domains && site.all_domains.split(" ").length > 1 && (
                                        <span style={{ fontSize: 10, color: "var(--text-secondary)", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                                          +{site.all_domains.split(" ").length - 1} ALIAS
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--color-blue)", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                                      <ServerIcon size={12} /> {site.server_name} <span style={{ color: "var(--text-muted)" }}>({site.listen})</span>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px" }}>
                                  <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontWeight: 500 }}>
                                    {site.upstream}
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--text-primary)" }}>
                                  {site.reqs} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>/s</span>
                                </td>
                                <td style={{ padding: "16px 20px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                                    <span style={{ color: site.err_4xx > 0 ? "var(--color-warning)" : "var(--text-muted)" }}>
                                      4xx: {site.err_4xx}
                                    </span>
                                    <span style={{ color: site.err_5xx > 0 ? "var(--color-critical)" : "var(--text-muted)" }}>
                                      5xx: {site.err_5xx}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px" }}>
                                  {site.tls !== "—" ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: site.tls.includes("d") && parseInt(site.tls) < 30 ? "var(--color-warning)" : "var(--color-healthy)" }}>
                                      <Lock size={12} /> Valid ({site.tls})
                                    </div>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "16px 20px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: site.status === "Healthy" ? "var(--color-healthy)" : "var(--color-warning)" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: site.status === "Healthy" ? "var(--color-healthy)" : "var(--color-warning)", boxShadow: `0 0 8px ${site.status === "Healthy" ? "var(--color-healthy)" : "var(--color-warning)"}` }} />
                                    {site.status}
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px", textAlign: "right", color: "var(--text-muted)" }}>
                                  <ChevronRight size={16} style={{ transform: isSelected ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {data?.site_pagination && data.site_pagination.total_pages > 1 && (
                    <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--text-secondary)", background: "rgba(0,0,0,0.2)" }}>
                      <span style={{ fontWeight: 500 }}>Showing {((data.site_pagination.page - 1) * data.site_pagination.page_size) + 1}–{Math.min(data.site_pagination.page * data.site_pagination.page_size, data.site_pagination.total)} of {data.site_pagination.total}</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="premium-btn" style={{ padding: "6px 10px" }}>
                          <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: Math.min(5, data.site_pagination.total_pages) }, (_, i) => {
                          const pg = i + 1;
                          return (
                            <button key={pg} onClick={() => setPage(pg)} className="premium-btn" style={{ padding: "6px 14px", background: page === pg ? "var(--color-blue)" : undefined, color: page === pg ? "#fff" : undefined, borderColor: page === pg ? "var(--color-blue)" : undefined }}>
                              {pg}
                            </button>
                          );
                        })}
                        {data.site_pagination.total_pages > 5 && <span style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>...</span>}
                        <button onClick={() => setPage(p => Math.min(data.site_pagination.total_pages, p + 1))} disabled={page === data.site_pagination.total_pages} className="premium-btn" style={{ padding: "6px 10px" }}>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Stats Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  
                  <div className="glass-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 16 }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "rgba(59,130,246,0.05)" }}>
                      <Network size={18} color="var(--color-blue)" />
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Upstream Health Check</h3>
                    </div>
                    <div style={{ padding: "12px 0", maxHeight: 300, overflowY: "auto" }}>
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.05em" }}>
                            <th style={{ padding: "8px 20px", textAlign: "left", fontWeight: 600 }}>POOL NAME</th>
                            <th style={{ padding: "8px 20px", textAlign: "left", fontWeight: 600 }}>HEALTH</th>
                            <th style={{ padding: "8px 20px", textAlign: "left", fontWeight: 600 }}>LATENCY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.upstream_health?.map((u: any, i: number) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                              <td style={{ padding: "12px 20px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{u.name}</td>
                              <td style={{ padding: "12px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: u.healthy < u.total ? "var(--color-warning)" : "var(--color-healthy)" }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.healthy < u.total ? "var(--color-warning)" : "var(--color-healthy)" }} />
                                  {u.healthy} / {u.total} up
                                </div>
                              </td>
                              <td style={{ padding: "12px 20px", color: "var(--text-secondary)", fontWeight: 500 }}>{u.response_time}</td>
                            </tr>
                          ))}
                          {(!data.upstream_health || data.upstream_health.length === 0) && (
                            <tr><td colSpan={3} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>No active upstreams detected.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 16 }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,0.05)" }}>
                      <ArrowUpDown size={18} color="var(--color-healthy)" />
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Recent Edge Events</h3>
                    </div>
                    <div style={{ padding: "12px 0", maxHeight: 300, overflowY: "auto", flex: 1 }}>
                      {data.recent_events?.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "30px 20px" }}>No recent events.</div>
                      ) : data.recent_events?.map((ev: any, i: number) => (
                        <div key={i} style={{ padding: "10px 20px", display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                          {i !== data.recent_events.length - 1 && <div style={{ position: "absolute", left: 24, top: 24, bottom: -10, width: 2, background: "var(--border-subtle)", zIndex: 0 }} />}
                          <span style={{ marginTop: 5, width: 10, height: 10, borderRadius: "50%", background: "var(--color-blue)", flexShrink: 0, zIndex: 1, boxShadow: `0 0 10px var(--color-blue)`, border: "2px solid var(--bg-card)" }} />
                          <div style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 4 }}>
                              {new Date(ev.time).toLocaleTimeString()} <span style={{ margin: "0 6px" }}>•</span> {ev.server}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>{ev.event}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
              
              {/* Right Sidebar */}
              {selectedSite && (
                <div className="glass-panel slide-in-right" style={{ display: "flex", flexDirection: "column", borderRadius: 16, border: "1px solid var(--color-blue)", boxShadow: "0 0 20px rgba(59,130,246,0.1)" }}>
                  <div style={{ padding: "20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(59,130,246,0.1)", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Globe size={18} color="var(--color-blue)" />
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Host Configuration</h3>
                    </div>
                    <button onClick={() => setSelectedSite(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
                    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16, borderBottom: "1px solid var(--border-subtle)" }}>
                      <DetailRow label="Domain" value={selectedSite.all_domains && !["_", "-", "—"].includes(selectedSite.all_domains.trim()) ? selectedSite.all_domains : selectedSite.domain} emphasize />
                      <DetailRow label="Nginx Node" value={selectedSite.server_name} icon={<ServerIcon size={14} />} color="var(--color-blue)" />
                      <DetailRow label="Listen Address" value={selectedSite.listen} fontMono />
                      <DetailRow label="Live Traffic" value={`${selectedSite.reqs} req/s`} fontMono />
                      <DetailRow label="Errors (4xx / 5xx)" value={`${selectedSite.err_4xx} / ${selectedSite.err_5xx}`} fontMono color={selectedSite.err_5xx > 0 ? "var(--color-critical)" : (selectedSite.err_4xx > 0 ? "var(--color-warning)" : undefined)} />
                      <DetailRow label="Upstream Pool" value={selectedSite.upstream} fontMono />
                      <DetailRow label="Proxy Target" value={selectedSite.proxy_targets?.join(", ") || "—"} fontMono />
                      <DetailRow label="TLS Encryption" value={selectedSite.tls !== "—" ? `Managed (${selectedSite.tls})` : "—"} color={selectedSite.tls !== "—" ? "var(--color-healthy)" : undefined} />
                      <DetailRow label="State" value={selectedSite.status} color={selectedSite.status === "Healthy" ? "var(--color-healthy)" : "var(--color-warning)"} />
                    </div>
                    
                    <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>
                        <FileText size={16} color="var(--color-purple)" /> Server Block Source
                      </div>
                      <div style={{ 
                        background: "#0d1117", border: "1px solid #30363d", padding: "16px", borderRadius: 8, 
                        fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, overflowX: "auto", flex: 1,
                        whiteSpace: "pre", color: "#e6edf3", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)"
                      }}>
                        {selectedConfigSnippet}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}

// ─────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────

function SummaryCard({ icon: Icon, title, value, label, color = "inherit", valueColor, glow }: any) {
  return (
    <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", borderRadius: 16, position: "relative", overflow: "hidden" }}>
      {glow && (
        <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: glow, filter: "blur(40px)", opacity: 0.15, borderRadius: "50%" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>
        <Icon size={14} color={glow || "var(--text-muted)"} />
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: valueColor || "var(--text-primary)", marginBottom: 6, lineHeight: 1.1, fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon, color, fontMono, emphasize }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <span style={{ color: "var(--text-secondary)", fontSize: 13, minWidth: 110, fontWeight: 500 }}>{label}</span>
      <span style={{ 
        color: color || "var(--text-primary)", 
        fontSize: emphasize ? 15 : 13, 
        fontWeight: emphasize ? 700 : 500,
        textAlign: "right",
        wordBreak: "break-word",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: fontMono ? "var(--font-mono)" : "inherit"
      }}>
        {icon}
        {value}
      </span>
    </div>
  );
}
