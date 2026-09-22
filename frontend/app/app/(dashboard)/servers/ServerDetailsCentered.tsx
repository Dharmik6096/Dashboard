"use client";
import { routes } from "@/lib/routes";
import { useEffect, useState } from "react";
import { XCircle, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import type { Server } from "@/types";
import { formatLastSeen, metricColor, capitalize } from "@/lib/formatters";

const ENV_BADGE: Record<string, string> = {
  production: "badge-production",
  database: "badge-database",
  staging: "badge-staging",
  development: "badge-development",
  qa: "badge-qa",
};

function bytes(b?: number): string {
  if (b == null) return "—";
  if (!b) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(1)}${units[i]}`;
}

export function ServerDetailsCentered({ server, onClose, router }: { server: Server, onClose: () => void, router: any }) {
  const [containers, setContainers] = useState<any[] | null>(null);
  const [disk, setDisk] = useState<any[] | null>(null);
  const [network, setNetwork] = useState<any[] | null>(null);
  const [alerts, setAlerts] = useState<any[] | null>(null);

  const [loadingOverview, setLoadingOverview] = useState(true);
  
  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, dRes, nRes, aRes] = await Promise.allSettled([
          api.get(`/containers?server_id=${server.id}`),
          api.get(`/servers/${server.id}/disk`),
          api.get(`/servers/${server.id}/network`),
          api.get(`/alerts?server_id=${server.id}`)
        ]);
        
        if (cRes.status === "fulfilled") setContainers(cRes.value.data || []);
        if (dRes.status === "fulfilled") setDisk(dRes.value.data?.disks || []);
        if (nRes.status === "fulfilled") setNetwork(nRes.value.data?.interfaces || []);
        if (aRes.status === "fulfilled") setAlerts(aRes.value.data || []);
      } catch (err) {
        console.error("Failed to load details", err);
      } finally {
        setLoadingOverview(false);
      }
    }
    loadData();
  }, [server.id]);

  const runningContainers = (containers || []).filter(c => c.status === "running").length;
  const stoppedContainers = (containers || []).filter(c => c.status === "exited" || c.status === "stopped").length;
  const unhealthyContainers = (containers || []).filter(c => c.status === "unhealthy").length;

  return (
    <div className="centered-details" style={{ margin: "auto", width: "100%", maxWidth: 950, display: "flex", flexDirection: "column", padding: 0, animation: "fadeIn 0.3s ease", maxHeight: "85vh", overflow: "hidden", background: "rgba(17, 24, 39, 0.65)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.6)", borderRadius: 12, zIndex: 100 }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{server.name}</h2>
            <span className={`badge ${server.environment ? ENV_BADGE[server.environment.toLowerCase()] : "badge-info"}`}>
              {server.environment || "None"}
            </span>
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 16 }}>
            <span>{server.ip_address}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: server.status === "online" ? "var(--color-healthy)" : "var(--color-critical)", fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", boxShadow: "0 0 8px currentColor" }} />
              {capitalize(server.status)}
            </span>
            <span>Last seen {server.last_seen ? formatLastSeen(server.last_seen) : "Never"}</span>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: "6px 12px" }}>
          <XCircle size={18} style={{ marginRight: 6 }} /> Close
        </button>
      </div>

      <div style={{ padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 40, flex: 1 }}>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 40, animation: "fadeIn 0.15s ease" }}>
          {/* Live Resources */}
          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Live Resources</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
              {[
                { label: "CPU", value: server.last_cpu_percent, suffix: "%" },
                { label: "RAM", value: server.last_ram_percent, suffix: "%" },
                { label: "Disk", value: server.last_disk_percent, suffix: "%" },
              ].map(metric => (
                  <div key={metric.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{metric.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{metric.value != null ? `${metric.value.toFixed(0)}${metric.suffix}` : "—"}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(metric.value || 0, 100)}%`, background: metricColor(metric.value || 0), borderRadius: 3 }} />
                    </div>
                  </div>
              ))}
              <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: "var(--text-secondary)" }}>Load</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{server.load_avg != null ? server.load_avg.toFixed(2) : "—"}</span>
                  </div>
              </div>
            </div>
          </section>

          {/* Alerts & Investigate */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 32 }}>
            <section>
                <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Active Alerts</h3>
                {loadingOverview ? (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading alerts...</div>
                ) : !alerts || alerts.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: 13, background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>No active alerts.</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {alerts.slice(0, 3).map((a, i) => (
                          <div key={i} style={{ background: a.severity === "critical" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)", border: `1px solid ${a.severity === "critical" ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)"}`, padding: "12px 16px", borderRadius: 8 }}>
                            <div style={{ color: a.severity === "critical" ? "var(--color-critical)" : "var(--color-warning)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>{a.severity}</div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{a.alert_name || a.title}</div>
                          </div>
                      ))}
                    </div>
                )}
            </section>

            <section>
                <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Investigate</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ justifyContent: "space-between", width: "100%", padding: "10px 16px", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", borderRadius: 6 }} onClick={() => router.push(routes.server(server.id))}>
                      <span>Full Dashboard</span>
                      <ArrowRight size={14} color="var(--text-muted)" />
                    </button>
                    
                    {[
                        { label: "Processes", key: "processes" },
                        { label: "Containers", key: "containers" },
                        { label: "Storage", key: "storage" },
                        { label: "Network", key: "network" },
                        { label: "Ports", key: "ports" },
                        { label: "Alerts", key: "alerts" },
                    ].map(link => (
                        <button key={link.label} className="btn btn-ghost" style={{ justifyContent: "space-between", width: "100%", padding: "10px 16px", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", borderRadius: 6 }} onClick={() => router.push(routes.serverTab(server.id, link.key))}>
                          <span>{link.label}</span>
                          <ArrowRight size={14} color="var(--text-muted)" />
                        </button>
                    ))}
                </div>
            </section>
          </div>

          {/* System & Docker */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>System Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "10px 16px", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Hostname</span><span style={{ fontFamily: "var(--font-mono)" }}>{server.hostname || "—"}</span>
                <span style={{ color: "var(--text-secondary)" }}>OS</span><span>{ (server as any).os || "—" }</span>
                <span style={{ color: "var(--text-secondary)" }}>Architecture</span><span>{ (server as any).architecture || "—" }</span>
                <span style={{ color: "var(--text-secondary)" }}>CPU Cores</span><span>{ (server as any).cpu_cores || "—" }</span>
                <span style={{ color: "var(--text-secondary)" }}>Total RAM</span><span>{ (server as any).ram_total ? bytes((server as any).ram_total) : "—" }</span>
                <span style={{ color: "var(--text-secondary)" }}>Uptime</span><span>{server.uptime_seconds ? `${Math.floor(server.uptime_seconds / 86400)}d ${Math.floor((server.uptime_seconds % 86400) / 3600)}h` : "—"}</span>
                <span style={{ color: "var(--text-secondary)" }}>Primary IP</span><span style={{ fontFamily: "var(--font-mono)" }}>{server.ip_address}</span>
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Docker</h3>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "10px 16px", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Engine</span><span>{loadingOverview ? "..." : (containers && containers.length > 0 ? "Available" : "No Containers detected")}</span>
                <span style={{ color: "var(--text-secondary)" }}>Containers</span><span>{loadingOverview ? "..." : (containers?.length || 0)}</span>
                <span style={{ color: "var(--text-secondary)" }}>Running</span><span style={{ color: runningContainers > 0 ? "var(--color-healthy)" : "inherit" }}>{loadingOverview ? "..." : runningContainers}</span>
                <span style={{ color: "var(--text-secondary)" }}>Stopped</span><span>{loadingOverview ? "..." : stoppedContainers}</span>
                <span style={{ color: "var(--text-secondary)" }}>Unhealthy</span><span style={{ color: unhealthyContainers > 0 ? "var(--color-critical)" : "inherit" }}>{loadingOverview ? "..." : unhealthyContainers}</span>
              </div>
            </section>
          </div>

          {/* Storage Summary */}
          <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Storage Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px", gap: 16, fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, color: "var(--text-secondary)" }}>
                <span>Filesystem / Mount</span>
                <span style={{ textAlign: "right" }}>Total</span>
                <span style={{ textAlign: "right" }}>Used</span>
                <span style={{ textAlign: "right" }}>Free</span>
                <span style={{ textAlign: "right" }}>Usage %</span>
              </div>
              {loadingOverview ? (
                  <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading storage...</div>
              ) : !disk || disk.length === 0 ? (
                  <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>—</div>
              ) : disk.slice(0, 5).map((d: any, i) => {
                  const pct = d.percent != null ? d.percent : (d.total > 0 ? Math.round((d.used / d.total) * 100) : 0);
                  return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px", gap: 16, fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.mountpoint || d.device}>{d.mountpoint || d.device}</span>
                    <span style={{ textAlign: "right" }}>{bytes(d.total)}</span>
                    <span style={{ textAlign: "right" }}>{bytes(d.used)}</span>
                    <span style={{ textAlign: "right" }}>{bytes(d.free)}</span>
                    <span style={{ textAlign: "right", color: pct >= 90 ? "var(--color-critical)" : pct >= 80 ? "var(--color-warning)" : "inherit" }}>{pct}%</span>
                  </div>
                  );
              })}
          </section>

          {/* Network & Monitoring */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Network Summary</h3>
              {loadingOverview ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading network...</div>
              ) : !network || network.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>—</div>
              ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                    {network.slice(0, 4).map((iface: any) => (
                        <div key={iface.name} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "4px 16px", alignItems: "start" }}>
                            <span style={{ color: "var(--text-secondary)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{iface.name}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                                RX: {bytes(iface.rx_bytes)} &nbsp; TX: {bytes(iface.tx_bytes)}
                            </span>
                        </div>
                    ))}
                  </div>
              )}
            </section>

            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>Monitoring Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px 16px", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Monitoring Status</span>
                <span style={{ color: server.status === "online" ? "var(--color-healthy)" : "var(--color-critical)" }}>{capitalize(server.status)}</span>
                
                <span style={{ color: "var(--text-secondary)" }}>Collection Mode</span>
                <span style={{ textTransform: "capitalize" }}>{server.monitoring_mode || "—"}</span>
                
                <span style={{ color: "var(--text-secondary)" }}>Authentication</span>
                <span>{server.auth_type ? `${capitalize(server.auth_type)} configured` : "None"}</span>
                
                <span style={{ color: "var(--text-secondary)" }}>Data Freshness</span>
                <span>{server.last_success_at ? formatLastSeen(server.last_success_at) : "—"}</span>
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
