"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";
import type { Alert } from "@/types";
import { AlertTriangle, CheckCircle, Bell, RefreshCw, X } from "lucide-react";

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "12px 14px" }}>
          <div className="skeleton" style={{ height: 14, borderRadius: 4, width: i === 1 ? "85%" : "55%" }} />
        </td>
      ))}
    </tr>
  );
}

function severityColor(s: string) {
  if (s === "critical") return "var(--color-critical)";
  if (s === "warning") return "var(--color-warning)";
  if (s === "info") return "var(--color-blue)";
  return "var(--text-secondary)";
}

function AlertDetailDrawer({ alert, onClose }: { alert: Alert | null, onClose: () => void }) {
  if (!alert) return null;

  return (
    <div style={{
      position: "fixed",
      top: "var(--topbar-height, 58px)",
      right: 0,
      bottom: 0,
      width: 450,
      background: "var(--bg-sidebar)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      transform: "translateX(0)",
      animation: "slideInRight 0.2s ease"
    }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={18} style={{ color: severityColor(alert.severity) }} />
          Alert Details
        </h2>
        <button className="btn btn-ghost" style={{ padding: 6, minHeight: "auto" }} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Overview</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{alert.alert_name || alert.title}</div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span className="badge" style={{ background: severityColor(alert.severity), color: "#fff" }}>
              {alert.severity.toUpperCase()}
            </span>
            <span className="badge" style={{ background: alert.status === "active" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", color: alert.status === "active" ? "var(--color-critical)" : "var(--color-healthy)", border: `1px solid ${alert.status === "active" ? "var(--color-critical)" : "var(--color-healthy)"}` }}>
              {alert.status.toUpperCase()}
            </span>
            {alert.server_name && (
              <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                Server: {alert.server_name}
              </span>
            )}
            {alert.container_name && (
              <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--color-blue)" }}>
                Container: {alert.container_name}
              </span>
            )}
          </div>
        </div>

        <div style={{ background: "var(--bg-hover)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Metric Condition</div>
          <div style={{ fontSize: 16, fontFamily: "var(--font-mono)" }}>
            {alert.metric_name} = <span style={{ color: "var(--color-critical)", fontWeight: 700 }}>{alert.current_value}</span>
            <span style={{ opacity: 0.5, margin: "0 8px" }}>&gt;</span>
            <span>{alert.threshold}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
            Alert triggered at {formatDateTime(alert.fired_at)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 12 }}>Incident Timeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, borderLeft: "2px solid var(--border)", paddingLeft: 16, marginLeft: 8 }}>

            {/* Condition Met */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: -21, top: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--color-warning)" }} />
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDateTime(alert.condition_started_at || alert.fired_at || alert.created_at)}</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>Condition Threshold Exceeded</div>
            </div>

            {/* Alert Fired */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: -21, top: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--color-critical)" }} />
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDateTime(alert.fired_at)}</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>Alert Fired & Notifications Sent</div>
            </div>

            {/* Acknowledged */}
            {alert.acknowledged_at && (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: -21, top: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--color-info)" }} />
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDateTime(alert.acknowledged_at)}</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>Alert Acknowledged</div>
              </div>
            )}

            {/* Resolved */}
            {alert.status === "resolved" && alert.resolved_at && (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: -21, top: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--color-healthy)" }} />
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatDateTime(alert.resolved_at)}</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>Alert Automatically Resolved</div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 12 }}>Related Event Correlations</div>
          <div className="card" style={{ padding: 16, background: "rgba(255,255,255,0.02)", textAlign: "center", border: "1px dashed var(--border)" }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>No correlated system events detected within ±5m of this incident.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useFilter } from "@/lib/FilterContext";

export default function AlertsPage() {
  const { envFilter, serverFilter } = useFilter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState({ active: 0, critical: 0, warning: 0 });
  const [statusFilter, setStatusFilter] = useState("active");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (envFilter !== "all") params.set("env", envFilter);
      if (serverFilter !== "all") params.set("server_id", serverFilter);
      const [aRes, sRes] = await Promise.all([
        api.get(`/alerts?${params}`),
        api.get(`/alerts/summary?${params}`),
      ]);
      setAlerts(aRes.data);
      setSummary(sRes.data);
    } catch { }
    finally { setLoading(false); }
  }, [statusFilter, severityFilter, envFilter, serverFilter]);

  useEffect(() => {
    let mounted = true;
    setTimeout(() => { if (mounted) loadAlerts(); }, 0);
    return () => { mounted = false; };
  }, [loadAlerts]);

  useEffect(() => {
    const iv = setInterval(loadAlerts, 15000);
    return () => clearInterval(iv);
  }, [loadAlerts]);

  return (
    <div className="fade-in" style={{ paddingRight: selectedAlert ? 450 : 0, transition: "padding var(--transition-slow)" }}>
      {/* Grafana-style Toolbar */}
      <div className="card" style={{ padding: "10px 16px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 16 }}>
          <Bell size={20} color="var(--primary)" />
          <h1 style={{ fontSize: "18px", margin: 0, fontWeight: 700, letterSpacing: "-0.3px" }}>Alerts</h1>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Status</span>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setLoading(true); }}
            style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", fontSize: 12, outline: "none" }}
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Severity</span>
          <select
            value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value); setLoading(true); }}
            style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px", fontSize: 12, outline: "none" }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          {summary.active > 0 ? (
            <span style={{ color: "var(--color-critical)", fontWeight: 600 }}>{summary.active} active alerts</span>
          ) : (
            <span style={{ color: "var(--color-healthy)", fontWeight: 500 }}>✓ All clear</span>
          )}
          <button onClick={loadAlerts} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 10px", borderRadius: 4, fontSize: 12, cursor: "pointer", transition: "0.15s" }} className="hover-bg-input">
            <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="metric-card" style={{ borderColor: summary.critical > 0 ? "rgba(239,68,68,0.2)" : undefined }}>
          <div className="metric-card-label" style={{ fontSize: 13 }}>
            <AlertTriangle size={15} style={{ color: "var(--color-critical)" }} />
            Critical
          </div>
          <div className="metric-card-value" style={{ color: summary.critical > 0 ? "var(--color-critical)" : "var(--text-primary)", fontSize: 32 }}>
            {summary.critical}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label" style={{ fontSize: 13 }}>
            <AlertTriangle size={15} style={{ color: "var(--color-warning)" }} />
            Warning
          </div>
          <div className="metric-card-value" style={{ color: summary.warning > 0 ? "var(--color-warning)" : "var(--text-primary)", fontSize: 32 }}>
            {summary.warning}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label" style={{ fontSize: 13 }}>
            <CheckCircle size={15} style={{ color: "var(--color-healthy)" }} />
            Total Active
          </div>
          <div className="metric-card-value" style={{ fontSize: 32 }}>
            {summary.active}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Status</th>
              <th>Server</th>
              <th>Alert</th>
              <th>Current Value</th>
              <th>Threshold</th>
              <th>Fired At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <CheckCircle size={40} style={{ color: "var(--color-healthy)", opacity: 0.8 }} />
                    <div className="empty-state-title" style={{ marginTop: 12 }}>No alerts found</div>
                    <div className="empty-state-desc">You are all caught up.</div>
                  </div>
                </td>
              </tr>
            ) : (
              alerts.map(a => (
                <tr key={a.id} className="clickable" onClick={() => setSelectedAlert(a)}>
                  <td>
                    <span className="badge" style={{ background: severityColor(a.severity), color: "#fff" }}>
                      {a.severity.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      color: a.status === "active" ? "var(--color-critical)" : "var(--color-healthy)",
                      fontWeight: 600, fontSize: 13
                    }}>
                      {a.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {a.server_name ? (
                      <span style={{ fontWeight: 500 }}>{a.server_name}</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{a.alert_name || a.title}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--color-critical)" }}>{a.current_value}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    &gt; {a.threshold}
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 14 }}>{formatDateTime(a.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDetailDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </div>
  );
}
