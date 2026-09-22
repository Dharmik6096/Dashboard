"use client";
import { useEffect, useState } from "react";
import { Activity, Server, ShieldAlert, Cpu } from "lucide-react";
import api from "@/lib/api";

export function Footer() {
  const [alertSummary, setAlertSummary] = useState({ active: 0, critical: 0, warning: 0 });
  const [serverCount, setServerCount] = useState<{ online: number; total: number } | null>(null);

  useEffect(() => {
    api.get("/alerts/summary")
      .then(r => setAlertSummary(r.data))
      .catch(() => {});
      
    api.get("/servers")
      .then(r => {
        const servers = r.data;
        setServerCount({
          total: servers.length,
          online: servers.filter((s: { status: string }) => s.status !== "offline").length,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "rgba(11, 16, 25, 0.8)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        color: "#64748b",
        fontSize: 12,
        fontWeight: 500,
        position: "relative",
        zIndex: 50,
        marginTop: "auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        
        {/* Brand / System Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8" }}>
          <Activity size={14} color="#3b82f6" />
          <span style={{ fontWeight: 600, letterSpacing: "0.03em" }}>Nexus DevOps</span>
        </div>

        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />

        {/* Server Status */}
        {serverCount !== null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Server size={14} />
            <span>
              Servers: <strong style={{ color: serverCount.online === serverCount.total && serverCount.total > 0 ? "#10b981" : "#f8fafc" }}>{serverCount.online}/{serverCount.total}</strong> Online
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.5 }}>
            <Server size={14} />
            <span>Loading servers...</span>
          </div>
        )}

        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />

        {/* Alert Summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldAlert size={14} color={alertSummary.critical > 0 ? "#ef4444" : alertSummary.warning > 0 ? "#f59e0b" : "#10b981"} />
          {alertSummary.active > 0 ? (
            <span style={{ color: alertSummary.critical > 0 ? "#fca5a5" : "#fcd34d" }}>
              {alertSummary.critical > 0 ? <strong style={{color:"#ef4444"}}>{alertSummary.critical} Critical</strong> : ""}
              {alertSummary.critical > 0 && alertSummary.warning > 0 ? ", " : ""}
              {alertSummary.warning > 0 ? <span>{alertSummary.warning} Warning</span> : ""}
            </span>
          ) : (
            <span style={{ color: "#10b981" }}>System Healthy</span>
          )}
        </div>

      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Backend API Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }} />
          <span style={{ color: "#94a3b8" }}>API Online</span>
        </div>
        
        <div style={{ padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6, color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>
          v2.4.0-stable
        </div>
      </div>
    </footer>
  );
}
