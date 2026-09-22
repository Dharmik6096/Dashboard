"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { Server as ServerIcon, Network, FileText, Lock, Activity, ChevronLeft, ChevronRight, CheckCircle, Database, Users, Mail, ActivitySquare, Server, Copy, Search, RefreshCw, X } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { EnvironmentSelect } from "@/components/ui/EnvironmentSelect";

export default function RabbitmqPage() {
  const [environment, setEnvironment] = useState("All Environments");
  const [serverFilter, setServerFilter] = useState("all");
  const [vhostFilter, setVhostFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("1h");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<any>(null);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [showAllQueues, setShowAllQueues] = useState(false);

  const buildParams = useCallback(() => {
    return {
      environment: environment === "All Environments" ? "all" : environment,
      server_id: serverFilter,
      vhost: vhostFilter,
      search,
      page,
      page_size: pageSize
    };
  }, [environment, serverFilter, vhostFilter, search, page, pageSize]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const params = buildParams();
      const res = await api.get("/rabbitmq/brokers", { params });
      setData(res.data);

      setSelectedBroker((prev: any) => {
        if (!prev) return null;
        const stillExists = res.data.brokers?.find((b: any) => b.container_id === prev.container_id);
        return stillExists || null;
      });
    } catch (err: any) {
      setError(err.message || "Unable to load RabbitMQ monitoring data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleBrokerClick = (broker: any) => {
    setSelectedBroker(broker);
    setShowAllQueues(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const serverOptions = useMemo(() => {
    if (!data?.filters?.servers) return [{ value: "all", label: "All Servers" }];
    return [{ value: "all", label: "All Servers" }, ...data.filters.servers.map((s: any) => ({ value: s.id, label: s.name }))];
  }, [data]);

  const brokerOptions = useMemo(() => {
    if (!data?.brokers) return [{ value: "all", label: "All Brokers" }];
    const uniqueBrokers = new Map();
    data.brokers.forEach((b: any) => uniqueBrokers.set(b.container_id, b.broker_name));
    return [{ value: "all", label: "All Brokers" }, ...Array.from(uniqueBrokers.entries()).map(([k, v]) => ({ value: k, label: v }))];
  }, [data]);

  const vhostOptions = useMemo(() => {
    if (!data?.filters?.vhosts) return [{ value: "all", label: "All VHosts" }];
    return [{ value: "all", label: "All VHosts" }, ...data.filters.vhosts.filter(Boolean).map((v: string) => ({ value: v, label: v }))];
  }, [data]);

  if (error && !data) {
    return (
      <div className="fade-in" style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center", background: "var(--bg-card)", padding: "40px", borderRadius: "16px", border: "1px solid var(--border-error)", boxShadow: "0 8px 32px rgba(239,68,68,0.1)" }}>
          <ActivitySquare size={48} style={{ color: "var(--color-critical)", marginBottom: "16px", margin: "0 auto" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Connection Lost</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px", maxWidth: "300px" }}>{error}</p>
          <button className="btn btn-primary" onClick={() => loadData()} style={{ background: "var(--color-critical)", color: "#fff", border: "none" }}>Retry Connection</button>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", animation: "fadeInDown 0.4s ease-out" }}>
      
      {/* Header Section */}
      <div style={{
        background: "linear-gradient(145deg, rgba(255, 102, 0, 0.1) 0%, rgba(17,24,39,0.8) 100%)",
        backdropFilter: "blur(12px)",
        borderRadius: "var(--radius-xl)",
        padding: "32px",
        border: "1px solid rgba(255, 102, 0, 0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          top: "-50%", right: "10%",
          width: "300px", height: "300px",
          background: "radial-gradient(circle, #ff6600 0%, transparent 70%)",
          opacity: 0.1,
          filter: "blur(40px)",
          borderRadius: "50%"
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: "24px", zIndex: 1 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "20%",
            background: "linear-gradient(135deg, #ff6600, #ff8c42)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", flexShrink: 0,
            boxShadow: "0 8px 32px rgba(255, 102, 0, 0.4), inset 0 -4px 12px rgba(0,0,0,0.2)"
          }}>
            <ActivitySquare size={36} />
          </div>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "4px", display: "flex", alignItems: "center", gap: "12px" }}>
              RabbitMQ Cluster
              <span style={{ fontSize: "12px", background: "rgba(16, 185, 129, 0.1)", color: "var(--color-healthy)", padding: "4px 10px", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", gap: "4px" }}>
                <div className="live-dot" style={{ width: 6, height: 6, background: "var(--color-healthy)", borderRadius: "50%" }}/> LIVE
              </span>
            </h1>
            <p style={{ fontSize: "15px", color: "var(--text-secondary)", margin: 0 }}>
              Enterprise monitoring for brokers, queues, throughput, and connectivity across all active servers.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", background: "var(--bg-elevated)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <EnvironmentSelect value={environment} onChange={setEnvironment} width={180} />
        <SearchableCombobox value={serverFilter} onChange={setServerFilter} options={serverOptions} placeholder="All Servers" width={180} />
        <SearchableCombobox value={vhostFilter} onChange={setVhostFilter} options={vhostOptions} placeholder="All VHosts" width={180} />

        <div style={{ width: 1, height: 32, background: "var(--border)", margin: "0 8px" }} />

        <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", padding: "4px" }}>
          {["LIVE", "1h", "6h", "24h"].map(tr => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              style={{
                background: timeRange === tr ? "var(--bg-active)" : "transparent",
                color: timeRange === tr ? "var(--text-primary)" : "var(--text-secondary)",
                border: "none", padding: "6px 16px", fontSize: "13px", cursor: "pointer", fontWeight: timeRange === tr ? 600 : 500,
                borderRadius: "6px", transition: "all 0.2s"
              }}
            >
              {tr}
            </button>
          ))}
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", height: "36px", padding: "0 16px", background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", opacity: (refreshing || loading) ? 0.7 : 1, transition: "all 0.2s" }}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards Grid - Forced on one line */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "16px", alignItems: "stretch" }}>
        <SummaryCard icon={<ServerIcon size={18} />} title="Active Brokers" value={summary.total_brokers || 0} label={`${summary.servers_count || 0} servers connected`} color="#ff6600" />
        <SummaryCard icon={<CheckCircle size={18} />} title="Healthy Nodes" value={summary.healthy_brokers || 0} label="Responding normally" color="var(--color-healthy)" />
        <SummaryCard icon={<Database size={18} />} title="Total Queues" value={summary.queues || 0} label="Across all vhosts" color="var(--color-purple)" />
        <SummaryCard icon={<Users size={18} />} title="Consumers" value={summary.consumers || 0} label="Active subscribers" color="var(--color-blue)" />
        <SummaryCard icon={<Mail size={18} />} title="Messages Ready" value={summary.messages_ready >= 1000 ? (summary.messages_ready / 1000).toFixed(1) + 'K' : (summary.messages_ready || 0)} label="Waiting in queues" color="var(--color-warning)" />
        <SummaryCard icon={<Activity size={18} />} title="Publish / Sec" value={summary.publish_rate || 0} label="Current throughput" color="var(--color-teal)" />
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flex: 1 }}>
        
        {/* Left Area - Inventory & Bottom Panels */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          
          {/* Inventory Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                  <Server size={18} className="text-blue" /> RabbitMQ Inventory
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", background: "var(--bg-input)", padding: "4px 10px", borderRadius: "12px", fontWeight: 500 }}>
                  {data?.summary?.total_brokers || 0} brokers
                </span>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search brokers, containers..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: "260px", padding: "8px 12px 8px 32px", fontSize: "13px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", outline: "none" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Broker</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Server</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>VHost</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Ready Msg</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Unacked</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Queues</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Consumers</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading brokers...</td></tr>
                  ) : data?.brokers?.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", fontSize: "14px" }}>No RabbitMQ instances found matching your criteria.</td></tr>
                  ) : (
                    data?.brokers?.map((broker: any) => (
                      <tr
                        key={broker.container_id}
                        onClick={() => handleBrokerClick(broker)}
                        style={{
                          cursor: "pointer",
                          background: selectedBroker?.container_id === broker.container_id ? "var(--bg-active)" : "transparent",
                          borderBottom: "1px solid var(--border-subtle)",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => { if (selectedBroker?.container_id !== broker.container_id) e.currentTarget.style.background = "var(--bg-hover)" }}
                        onMouseLeave={e => { if (selectedBroker?.container_id !== broker.container_id) e.currentTarget.style.background = "transparent" }}
                      >
                        <td style={{ padding: "16px 20px", fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>
                          {broker.broker_name}
                        </td>
                        <td style={{ padding: "16px 20px", fontWeight: 500, color: "var(--color-blue)", fontSize: "13px" }}>
                          {broker.server_name}
                        </td>
                        <td style={{ padding: "16px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                          {broker.vhost}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{ 
                            display: "inline-flex", alignItems: "center", gap: "6px", 
                            padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600,
                            background: broker.status === "Healthy" ? "rgba(16, 185, 129, 0.1)" : (broker.status === "Warning" ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)"),
                            color: broker.status === "Healthy" ? "var(--color-healthy)" : (broker.status === "Warning" ? "var(--color-warning)" : "var(--color-critical)")
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                            {broker.status}
                          </span>
                        </td>
                        <td style={{ padding: "16px 20px", fontWeight: 600, color: broker.messages_ready > 5000 ? "var(--color-warning)" : "var(--text-primary)", fontSize: "14px" }}>
                          {broker.messages_ready >= 1000 ? (broker.messages_ready / 1000).toFixed(1) + 'K' : broker.messages_ready}
                        </td>
                        <td style={{ padding: "16px 20px", color: "var(--text-secondary)", fontSize: "14px" }}>{broker.messages_unacked}</td>
                        <td style={{ padding: "16px 20px", color: "var(--text-secondary)", fontSize: "14px" }}>{broker.queues}</td>
                        <td style={{ padding: "16px 20px", color: "var(--text-secondary)", fontSize: "14px" }}>{broker.consumers}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data?.pagination && (
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}>
                <div>
                  Showing <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{((data.pagination.page - 1) * data.pagination.page_size) + 1}</span> to <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{Math.min(data.pagination.page * data.pagination.page_size, data.pagination.total_items)}</span> of <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{data.pagination.total_items}</span> entries
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ padding: "6px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}><ChevronLeft size={16} /></button>
                  <span style={{ padding: "0 8px", fontWeight: 500, color: "var(--text-primary)" }}>Page {page} of {data.pagination.total_pages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.total_pages} style={{ padding: "6px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", cursor: page >= data.pagination.total_pages ? "not-allowed" : "pointer", opacity: page >= data.pagination.total_pages ? 0.5 : 1 }}><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panels - Restored from previous robust version */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            
            {/* CURRENT THROUGHPUT */}
            <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                  <Activity size={16} className="text-blue" /> Cluster Throughput
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Live</span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "24px" }}>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-blue)" }}></span> Publish Rate
                    </span>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>{summary.publish_rate || 0} <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>msg/s</span></span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: summary.publish_rate > 0 ? "100%" : "0%", height: "100%", background: "var(--color-blue)", borderRadius: "4px" }} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-healthy)" }}></span> Deliver Rate
                    </span>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>{summary.deliver_rate || 0} <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>msg/s</span></span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: summary.deliver_rate > 0 ? "100%" : "0%", height: "100%", background: "var(--color-healthy)", borderRadius: "4px" }} />
                  </div>
                </div>

              </div>
            </div>

            {/* TOP BUSY QUEUES */}
            <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                  <Database size={16} className="text-purple" /> Top Busy Queues
                </h3>
              </div>
              <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
                {data?.top_busy_queues?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>No active queues found.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {data?.top_busy_queues?.map((q: any, i: number) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{q.name}</span>
                          <span style={{ fontWeight: 600, color: "var(--color-warning)" }}>{q.messages_ready >= 1000 ? (q.messages_ready / 1000).toFixed(1) + 'K' : q.messages_ready}</span>
                        </div>
                        <div style={{ width: "100%", height: "6px", background: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (q.messages_ready / (data.top_busy_queues[0].messages_ready || 1)) * 100)}%`, height: "100%", background: "var(--color-warning)", borderRadius: "3px" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CONSUMERS BY QUEUE */}
            <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                  <Users size={16} className="text-teal" /> Consumers by Queue
                </h3>
              </div>
              <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
                {data?.top_consumer_queues?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>No consumers found.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {data?.top_consumer_queues?.map((q: any, i: number) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{q.name}</span>
                          <span style={{ fontWeight: 600, color: "var(--color-teal)" }}>{q.consumers}</span>
                        </div>
                        <div style={{ width: "100%", height: "6px", background: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (q.consumers / (data.top_consumer_queues[0].consumers || 1)) * 100)}%`, height: "100%", background: "var(--color-teal)", borderRadius: "3px" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RECENT EVENTS */}
            <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                  <FileText size={16} className="text-orange" /> Recent Events
                </h3>
              </div>
              <div style={{ overflowX: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <tbody>
                    {data?.recent_events?.length === 0 ? (
                      <tr><td style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No recent events.</td></tr>
                    ) : (
                      data?.recent_events?.slice(0, 5).map((e: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--text-primary)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ 
                                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                background: e.event.includes("High") || e.event.includes("Alarm") ? "var(--color-critical)" : (e.event.includes("connected") ? "var(--color-healthy)" : "var(--color-blue)") 
                              }}></span>
                              {e.event}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Right Area - Detail Panel */}
        {selectedBroker && (
          <div className="card slide-in-right" style={{ width: "400px", padding: 0, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: "80px", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ padding: "24px", background: "linear-gradient(135deg, rgba(30,42,63,0.8), rgba(17,24,39,1))", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: "-10%", top: "-20%", width: "120px", height: "120px", background: "#ff6600", opacity: 0.15, filter: "blur(24px)", borderRadius: "50%" }} />
              <div style={{ zIndex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>{selectedBroker.broker_name}</h3>
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Server size={14}/> {selectedBroker.server_name}
                </span>
              </div>
              <button onClick={() => setSelectedBroker(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", cursor: "pointer", borderRadius: "50%", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
              
              {selectedBroker.api_error && (
                <div style={{ padding: "16px 24px", background: "rgba(239, 68, 68, 0.1)", borderBottom: "1px solid var(--border)", borderLeft: "4px solid var(--color-critical)" }}>
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--color-critical)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <ActivitySquare size={14} /> Diagnostic Warning
                  </h4>
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {selectedBroker.api_error} <br/>Some performance details and metadata will be missing (showing 0).
                  </p>
                </div>
              )}
              
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px", borderBottom: "1px solid var(--border)" }}>
                <h4 style={{ margin: 0, fontSize: "13px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>Performance Specs</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <MetricBox label="Msg Ready" value={selectedBroker.messages_ready >= 1000 ? (selectedBroker.messages_ready / 1000).toFixed(1) + 'K' : selectedBroker.messages_ready} color="var(--color-warning)" />
                  <MetricBox label="Msg Unacked" value={selectedBroker.messages_unacked} color="var(--color-blue)" />
                  <MetricBox label="Publish Rate" value={`${selectedBroker.publish_rate}/s`} color="var(--color-teal)" />
                  <MetricBox label="Deliver Rate" value={`${selectedBroker.deliver_rate}/s`} color="var(--color-healthy)" />
                </div>
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", borderBottom: "1px solid var(--border)" }}>
                <h4 style={{ margin: 0, fontSize: "13px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "4px" }}>System Details</h4>
                <DetailRow label="Container ID" value={selectedBroker.container_id?.substring(0,12)} />
                <DetailRow label="Node Name" value={selectedBroker.node_name} />
                <DetailRow label="RabbitMQ Version" value={selectedBroker.rabbitmq_version} />
                <DetailRow label="Erlang Version" value={selectedBroker.erlang_version} />
                <DetailRow label="Channels" value={selectedBroker.channels} />
                <DetailRow label="Connections" value={selectedBroker.connections} />
                <DetailRow label="Memory Used" value={`${Math.round(selectedBroker.memory_used / 1024 / 1024)} MB`} />
                <DetailRow label="Disk Free Alarm" value={selectedBroker.disk_alarm ? "Triggered" : "OK"} color={selectedBroker.disk_alarm ? "var(--color-critical)" : "var(--color-healthy)"} />
              </div>

              {/* Added Queue Health Section back */}
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "13px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>Queue / Exchange Health</h4>
                  {selectedBroker.queue_list?.length > 3 && (
                    <span onClick={() => setShowAllQueues(!showAllQueues)} style={{ fontSize: "12px", color: "var(--color-blue)", cursor: "pointer", fontWeight: 600 }}>
                      {showAllQueues ? "View Less" : "View All"}
                    </span>
                  )}
                </div>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "8px 4px", fontWeight: 600 }}>Name</th>
                      <th style={{ padding: "8px 4px", fontWeight: 600 }}>Type</th>
                      <th style={{ padding: "8px 4px", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBroker.queue_list?.slice(0, showAllQueues ? undefined : 3).map((q: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "10px 4px", color: "var(--text-primary)", fontWeight: 500 }}>{q.name}</td>
                        <td style={{ padding: "10px 4px", color: "var(--text-secondary)" }}>{q.type || "queue"}</td>
                        <td style={{ padding: "10px 4px", color: q.messages_unacked > 500 ? "var(--color-warning)" : "var(--color-healthy)", fontWeight: 600 }}>
                          {q.messages_unacked > 500 ? "Warning" : "Healthy"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h4 style={{ margin: 0, fontSize: "13px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Docker Connection</span>
                  <Copy size={14} style={{ cursor: "pointer", color: "var(--color-blue)" }} onClick={() => navigator.clipboard.writeText(`container: ${selectedBroker.container_name}`)} />
                </h4>
                <div style={{ background: "var(--bg-input)", color: "var(--color-blue)", padding: "16px", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", border: "1px solid var(--border)", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-muted)" }}>container:</span> {selectedBroker.container_name}{"\n"}
                  <span style={{ color: "var(--text-muted)" }}>image:</span> {selectedBroker.docker_image?.split("@")[0]}{"\n"}
                  <span style={{ color: "var(--text-muted)" }}>ports:</span> {selectedBroker.ports}{"\n"}
                  <span style={{ color: "var(--text-muted)" }}>network:</span> mq-network
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, value, label, color = "inherit" }: any) {
  return (
    <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden", border: `1px solid rgba(${color === "inherit" ? "128,128,128" : hexToRgb(color)}, 0.2)`, flex: 1, minHeight: "130px" }}>
      <div style={{ position: "absolute", right: "-10%", top: "-20%", width: "80px", height: "80px", background: color, opacity: 0.05, borderRadius: "50%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "16px", textTransform: "uppercase" }}>
        <span style={{ color, display: "flex", alignItems: "center", justifyContent: "center", background: `rgba(${hexToRgb(color)}, 0.1)`, padding: "6px", borderRadius: "8px" }}>{icon}</span>
        {title}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string, value: any, color: string }) {
  return (
    <div style={{ background: "var(--bg-input)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color: color }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, color }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "8px 0" }}>
      <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>{label}</span>
      <span style={{ color: color || "var(--text-primary)", fontSize: "14px", fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

// Helper for generic hex strings like "#ff6600" or var colors
function hexToRgb(hex: string) {
  if (hex.startsWith("var")) return "128,128,128"; // Fallback for CSS vars if parsing is hard
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "128,128,128";
}
