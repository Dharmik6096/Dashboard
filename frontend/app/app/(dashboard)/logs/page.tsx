"use client";
import React, { useCallback, useState, useEffect } from "react";
import { Server, Box, Layers, AlignLeft } from "lucide-react";
import api from "@/lib/api";
import { LogViewer, LogEntry } from "@/components/ui";
import { DashboardDataState } from "@/components/ui/DashboardDataState";

export default function LogsPage() {
  const [servers, setServers] = useState<{ id: string, name: string }[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [sourceType, setSourceType] = useState("container");
  const [sourceId, setSourceId] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState<{ id: string, name: string }[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [error, setError] = useState("");

  const loadServers = useCallback(async () => {
    setServersLoading(true);
    setError("");
    try {
      const res = await api.get("/servers");
      setServers(res.data);
      if (res.data.length > 0) setSelectedServer(res.data[0].id);
    } catch {
      setError("Server inventory could not be loaded for the log explorer.");
    } finally {
      setServersLoading(false);
    }
  }, []);

  useEffect(() => { void loadServers(); }, [loadServers]);

  const loadContainers = useCallback(async () => {
    if (selectedServer && sourceType === "container") {
      setError("");
      try {
        const res = await api.get(`/containers?server_id=${selectedServer}`);
        setContainers(res.data);
        if (res.data.length > 0) setSourceId(res.data[0].id);
        else setSourceId("");
      } catch {
        setContainers([]);
        setSourceId("");
        setError("Container inventory could not be loaded for the selected server.");
      }
    }
  }, [selectedServer, sourceType]);

  useEffect(() => { void loadContainers(); }, [loadContainers]);

  const fetchLogs = async (lines: number = 200) => {
    if (!selectedServer) return;

    setLoading(true);
    setError("");
    try {
      if (sourceType === "container" && sourceId) {
        const res = await api.get(`/containers/${sourceId}/logs?tail=${lines}`);
        let rawLogs = res.data.logs;
        if (typeof rawLogs === "string") {
          rawLogs = rawLogs.split("\n").filter((line: string) => line.trim() !== "");
        } else if (!rawLogs) {
          rawLogs = Array.isArray(res.data) ? res.data : [];
        }
        
        const mapped = rawLogs.map((l: any) => {
          if (typeof l === "string") {
            return { timestamp: "", level: "info", message: l, raw: l };
          }
          return { timestamp: l.timestamp || "", level: l.level || "info", message: l.message || l.raw || "", raw: l.raw || "" };
        });
        setLogs(mapped);
      } else if (sourceType === "nginx" || sourceType === "nginx_error" || sourceType === "syslog" || sourceType === "auth") {
        const res = await api.get(`/servers/${selectedServer}/logs?source=${sourceType}&lines=${lines}`);
        setLogs(res.data.logs || []);
      }
    } catch (e) {
      console.error(e);
      setLogs([]);
      setError("Logs could not be read. Confirm that the selected server is online and its read-only collector is reachable.");
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (!selectedServer) return void loadServers();
    if (sourceType === "container" && !sourceId) return void loadContainers();
    void fetchLogs(200);
  };

  useEffect(() => {
    if (selectedServer && (sourceType !== "container" || sourceId)) {
      setTimeout(() => fetchLogs(200), 0);
    } else {
      setTimeout(() => setLogs([]), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServer, sourceType, sourceId]);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "100%", paddingBottom: 24 }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "flex-end", 
        marginBottom: 24,
        background: "linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0) 100%)",
        padding: "20px 24px",
        borderRadius: "16px",
        border: "1px solid var(--border)",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: 10, borderRadius: 12, color: "var(--color-blue)" }}>
              <AlignLeft size={28} />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Global Logs</h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 15, maxWidth: 600 }}>
            Read recent logs from one selected server or container source. This view does not aggregate or mutate remote logs.
          </p>
        </div>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
        gap: 20, 
        marginBottom: 24, 
        background: "var(--bg-card)", 
        padding: 20, 
        borderRadius: "16px", 
        border: "1px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
            <Server size={14} /> Server Instance
          </label>
          <div style={{ position: "relative" }}>
            <select
              className="input"
              value={selectedServer}
              onChange={e => setSelectedServer(e.target.value)}
              disabled={serversLoading}
              style={{ width: "100%", paddingRight: 40, background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 10, height: 42 }}
            >
              {serversLoading ? <option>Loading servers...</option> : null}
              {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
            <Layers size={14} /> Log Source Type
          </label>
          <select
            className="input"
            value={sourceType}
            onChange={e => setSourceType(e.target.value)}
            style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 10, height: 42 }}
          >
            <option value="container">Docker Container Logs</option>
            <option value="syslog">System Logs (Syslog)</option>
            <option value="auth">Authentication Logs (Auth)</option>
            <option value="nginx">Nginx Access Logs</option>
            <option value="nginx_error">Nginx Error Logs</option>
          </select>
        </div>

        {sourceType === "container" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
              <Box size={14} /> Target Container
            </label>
            <select
              className="input"
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
              style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: 10, height: 42 }}
            >
              {containers.length === 0 && <option value="">No containers running on server</option>}
              {containers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {error ? <DashboardDataState kind="error" title="Log data unavailable" description={error} onRetry={retry} /> : <LogViewer
          logs={logs}
          loading={loading}
          onRefresh={fetchLogs}
          title={
            sourceType === 'container' 
              ? `Container: ${containers.find(c => c.id === sourceId)?.name || 'Unknown'}` 
              : `${sourceType.toUpperCase()} Logs (${servers.find(s => s.id === selectedServer)?.name || ''})`
          }
        />}
      </div>
    </div>
  );
}
