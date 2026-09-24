"use strict";
"use client";
import React, { useState, useEffect } from "react";
import { Activity, Server, AlertTriangle, Clock, RefreshCw, BarChart2 } from "lucide-react";
import api from "@/lib/api";

interface CpuSpike {
  id: string;
  timestamp: string;
  server_name: string;
  process_name: string;
  peak_usage: number;
  duration_seconds: number;
  severity: string;
}

export default function CpuSpikesPage() {
  const [spikes, setSpikes] = useState<CpuSpike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("All");
  const [filterServer, setFilterServer] = useState<string>("All");

  const fetchSpikes = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/alerts/cpu-spikes?limit=50");
      setSpikes(res.data);
    } catch (e) {
      console.error(e);
      setError("CPU spike history could not be loaded from the alerts API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpikes();
  }, []);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const filteredSpikes = spikes.filter(s => {
    if (filterSeverity !== "All" && s.severity !== filterSeverity) return false;
    if (filterServer !== "All" && s.server_name !== filterServer) return false;
    return true;
  });

  const uniqueServers = Array.from(new Set(spikes.map(s => s.server_name)));

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: 16,
        background: "linear-gradient(90deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0) 100%)",
        padding: "16px 20px",
        borderRadius: "12px",
        border: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: 10, borderRadius: 12, color: "var(--color-red)" }}>
              <Activity size={28} />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>CPU Spikes</h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 15, maxWidth: 600 }}>
            CPU-related alert records derived from the live alert engine. Values reflect the observation stored with each alert.
          </p>
        </div>
        <button 
          onClick={fetchSpikes}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 10,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            color: "var(--text)", fontWeight: 600, cursor: "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 200 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Severity</label>
          <select 
            value={filterSeverity} 
            onChange={e => setFilterSeverity(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="Warning">Warning</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 200 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Server</label>
          <select 
            value={filterServer} 
            onChange={e => setFilterServer(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
          >
            <option value="All">All Servers</option>
            {uniqueServers.map(srv => <option key={srv} value={srv}>{srv}</option>)}
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-card)", padding: 16, borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--color-red)", padding: 10, borderRadius: 10 }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Filtered Critical Spikes</p>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {filteredSpikes.filter(s => s.severity === "Critical").length}
            </h2>
          </div>
        </div>
        
        <div style={{ background: "var(--bg-card)", padding: 16, borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--color-yellow)", padding: 10, borderRadius: 10 }}>
            <Activity size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Avg Peak Usage</p>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {filteredSpikes.length ? (filteredSpikes.reduce((a, b) => a + b.peak_usage, 0) / filteredSpikes.length).toFixed(1) : 0}%
            </h2>
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", padding: 16, borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--color-blue)", padding: 10, borderRadius: 10 }}>
            <Clock size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Avg Spike Duration</p>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {filteredSpikes.length ? formatDuration(Math.floor(filteredSpikes.reduce((a, b) => a + b.duration_seconds, 0) / filteredSpikes.length)) : "0s"}
            </h2>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <BarChart2 size={18} color="var(--text-secondary)" />
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recorded CPU alerts</h2>
        </div>
        
        <div style={{ overflowX: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--bg-body)", color: "var(--text-secondary)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "12px 20px", fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: "12px 20px", fontWeight: 600 }}>Server</th>
                <th style={{ padding: "12px 20px", fontWeight: 600 }}>Source</th>
                <th style={{ padding: "12px 20px", fontWeight: 600 }}>Observed Value</th>
                <th style={{ padding: "12px 20px", fontWeight: 600 }}>Duration</th>
                <th style={{ padding: "12px 20px", fontWeight: 600 }}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredSpikes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                    <RefreshCw className="spin" style={{ margin: "0 auto", marginBottom: 12 }} />
                    Loading anomalies...
                  </td>
                </tr>
              ) : error ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--color-critical)" }}><AlertTriangle size={22} style={{ margin: "0 auto 10px" }} />{error}<br /><button type="button" onClick={fetchSpikes} className="btn btn-secondary" style={{ marginTop: 14 }}>Try again</button></td></tr>
              ) : filteredSpikes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                    No CPU spikes match your filters.
                  </td>
                </tr>
              ) : (
                filteredSpikes.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.2s" }} className="hover-row">
                    <td style={{ padding: "14px 20px", fontSize: 14 }}>{formatDate(s.timestamp)}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Server size={14} color="var(--text-secondary)" />
                        {s.server_name}
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontFamily: "monospace" }}>{s.process_name}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: s.peak_usage > 95 ? "var(--color-red)" : "var(--color-orange)" }}>
                      {s.peak_usage}%
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 14, color: "var(--text-secondary)" }}>{formatDuration(s.duration_seconds)}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ 
                        padding: "4px 10px", 
                        borderRadius: 20, 
                        fontSize: 12, 
                        fontWeight: 600,
                        background: s.severity === "Critical" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                        color: s.severity === "Critical" ? "var(--color-red)" : "var(--color-orange)" 
                      }}>
                        {s.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .hover-row:hover {
          background: rgba(255,255,255,0.03);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
