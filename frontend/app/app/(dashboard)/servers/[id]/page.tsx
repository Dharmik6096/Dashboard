"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Cpu, MemoryStick, HardDrive, Network, Box, AlertTriangle, Clock, Settings, Shield, Terminal, Zap, Info, Server as ServerIcon } from "lucide-react";
import api from "@/lib/api";
import { TimeSeriesChart } from "@/components/ui/charts";
import { formatPercent, formatLastSeen } from "@/lib/formatters";

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [server, setServer] = useState<any>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Metrics");

  const load = useCallback(async () => {
    try {
      const [sRes, cRes, hRes, aRes] = await Promise.allSettled([
        api.get(`/servers/${id}`),
        api.get(`/containers?server_id=${id}`),
        api.get(`/servers/${id}/metrics/history?period=1h`),
        api.get(`/alerts?server_id=${id}&status=active`),
      ]);

      if (sRes.status === "fulfilled") setServer(sRes.value.data);
      else { router.push("/app"); return; }
      
      if (cRes.status === "fulfilled") setContainers(cRes.value.data || []);
      if (hRes.status === "fulfilled") setHistory(hRes.value.data || []);
      
      if (aRes.status === "fulfilled") {
          const activeAlerts = (aRes.value.data || []).filter((a: any) => a.status === 'active');
          const uniqueAlerts = Array.from(new Map(activeAlerts.map((a: any) => [a.id, a])).values());
          setAlerts(uniqueAlerts);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !server) {
    return <div className="dd-loading">Loading Server Details…</div>;
  }
  
  if (!server) return null;

  return (
    <div className="dd-server-detail">
      <div className="dd-header-strip">
        <div className="breadcrumb">
          <Link href="/app">Infrastructure</Link> <ChevronRight size={14} /> 
          <span>Servers</span> <ChevronRight size={14} /> 
          <strong>{server.name}</strong>
        </div>
        <div className="dd-header-actions">
          <button className="btn-secondary"><Settings size={14} /> Settings</button>
        </div>
      </div>
      
      <div className="dd-metadata-strip">
        <div className="dd-meta-title">
          <ServerIcon size={24} color="#a0aab2" />
          <h1>{server.name}</h1>
          <span className={`dd-badge ${server.status === 'critical' ? 'critical' : server.status === 'warning' ? 'warning' : 'ok'}`}>
            {server.status?.toUpperCase()}
          </span>
        </div>
        <div className="dd-meta-props">
          <div className="dd-meta-item">
            <span className="lbl">IP ADDRESS</span>
            <span className="val">{server.ip_address || "N/A"}</span>
          </div>
          <div className="dd-meta-item">
            <span className="lbl">ENVIRONMENT</span>
            <span className="val">{server.environment || "production"}</span>
          </div>
          <div className="dd-meta-item">
            <span className="lbl">UPTIME</span>
            <span className="val">{server.uptime || "N/A"}</span>
          </div>
        </div>
        <div className="dd-meta-tags">
          {["role:web", "os:linux", "provider:aws"].map(t => (
            <span key={t} className="dd-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="dd-2col-layout">
        <div className="dd-left-col">
          <div className="dd-panel">
            <div className="dd-panel-title">Properties</div>
            <div className="dd-panel-body nopad">
              <table className="dd-props-table">
                <tbody>
                  <tr><td>Agent Version</td><td>v2.1.4</td></tr>
                  <tr><td>Last Seen</td><td>{server.last_seen ? formatLastSeen(server.last_seen) : "Just now"}</td></tr>
                  <tr><td>OS</td><td>{server.os || "Ubuntu 22.04 LTS"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="dd-panel" style={{ marginTop: 16 }}>
            <div className="dd-panel-title">Active Monitors ({alerts.length})</div>
            <div className="dd-panel-body nopad">
              {alerts.length === 0 ? (
                <div className="empty-state">No active alerts for this host.</div>
              ) : (
                <div className="dd-alert-list">
                  {alerts.map(a => (
                    <div key={a.id} className="dd-alert-item">
                      <div className={`severity-bar ${a.severity}`} />
                      <div>
                        <strong>{a.message}</strong>
                        <small>{a.metric} • {new Date(a.created_at).toLocaleString()}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="dd-right-col">
          <div className="dd-tabs">
            {["Metrics", "Containers", "Events"].map(t => (
              <button 
                key={t} 
                className={activeTab === t ? "active" : ""} 
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          
          <div className="dd-tab-content">
            {activeTab === "Metrics" && (
              <div className="dd-timeseries-grid">
                <div className="dd-panel">
                  <div className="dd-panel-title"><Cpu size={14} /> System CPU</div>
                  <div className="dd-panel-body">
                    <TimeSeriesChart data={history} lines={[{ key: "cpu", name: "CPU", color: "#fa709a" }]} />
                  </div>
                </div>
                <div className="dd-panel">
                  <div className="dd-panel-title"><MemoryStick size={14} /> System Memory</div>
                  <div className="dd-panel-body">
                    <TimeSeriesChart data={history} lines={[{ key: "ram", name: "RAM", color: "#4b42e8" }]} />
                  </div>
                </div>
                <div className="dd-panel">
                  <div className="dd-panel-title"><Network size={14} /> Network (RX/TX)</div>
                  <div className="dd-panel-body">
                    <TimeSeriesChart data={history} lines={[
                      { key: "rx", name: "Inbound", color: "#0ea5c8" },
                      { key: "tx", name: "Outbound", color: "#635bff" }
                    ]} />
                  </div>
                </div>
                <div className="dd-panel">
                  <div className="dd-panel-title"><Activity size={14} /> System Load</div>
                  <div className="dd-panel-body">
                    <TimeSeriesChart data={history} lines={[{ key: "load", name: "Load", color: "#f59e0b" }]} />
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "Containers" && (
              <div className="dd-panel">
                <div className="dd-panel-body nopad">
                  <table className="dd-table">
                    <thead>
                      <tr>
                        <th>Container Name</th>
                        <th>Status</th>
                        <th>CPU</th>
                        <th>Memory</th>
                      </tr>
                    </thead>
                    <tbody>
                      {containers.length === 0 ? (
                        <tr><td colSpan={4} className="text-center" style={{padding: 40}}>No containers found.</td></tr>
                      ) : (
                        containers.map(c => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td><span className={`dd-badge ${c.status === 'running' ? 'ok' : 'critical'}`}>{c.status}</span></td>
                            <td className="num">{formatPercent(c.last_cpu_percent)}</td>
                            <td className="num">{c.last_ram_bytes ? (c.last_ram_bytes / 1024 / 1024).toFixed(1) + " MB" : "0 MB"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === "Events" && (
              <div className="dd-panel">
                <div className="empty-state" style={{padding: 40}}>No recent events recorded for this host.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .dd-server-detail { color: #f0f0f0; }
        .dd-header-strip { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #a0aab2; }
        .breadcrumb a { color: #0ea5c8; text-decoration: none; }
        .breadcrumb strong { color: #fff; font-weight: 600; }
        
        .dd-metadata-strip { padding: 24px; background: #0b0c10; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .dd-meta-title { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .dd-meta-title h1 { margin: 0; font-size: 24px; font-weight: 700; color: #fff; }
        .dd-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .dd-badge.ok { background: rgba(67, 233, 123, 0.1); color: #43e97b; }
        .dd-badge.critical { background: rgba(255, 87, 87, 0.1); color: #ff5757; }
        .dd-badge.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        .dd-meta-props { display: flex; gap: 40px; margin-bottom: 16px; }
        .dd-meta-item { display: flex; flex-direction: column; gap: 4px; }
        .dd-meta-item .lbl { font-size: 11px; color: #64687a; font-weight: 600; }
        .dd-meta-item .val { font-size: 14px; font-weight: 500; font-family: monospace; }
        
        .dd-meta-tags { display: flex; gap: 8px; }
        .dd-tag { background: rgba(255,255,255,0.1); color: #a0aab2; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: monospace; }
        
        .dd-2col-layout { display: flex; gap: 24px; padding: 24px; }
        .dd-left-col { width: 300px; flex-shrink: 0; }
        .dd-right-col { flex: 1; min-width: 0; }
        
        .dd-props-table { width: 100%; font-size: 13px; }
        .dd-props-table td { padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .dd-props-table td:first-child { color: #a0aab2; font-weight: 500; width: 40%; }
        .dd-props-table td:last-child { color: #fff; }
        
        .dd-alert-list { display: flex; flex-direction: column; }
        .dd-alert-item { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .dd-alert-item .severity-bar { width: 4px; border-radius: 2px; }
        .dd-alert-item .severity-bar.critical { background: #ff5757; }
        .dd-alert-item .severity-bar.warning { background: #f59e0b; }
        .dd-alert-item strong { display: block; font-size: 13px; margin-bottom: 4px; }
        .dd-alert-item small { color: #a0aab2; font-size: 11px; }
        
        .dd-tabs { display: flex; gap: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; }
        .dd-tabs button { background: none; border: none; color: #a0aab2; padding: 0 0 12px 0; font-size: 14px; font-weight: 500; cursor: pointer; position: relative; }
        .dd-tabs button.active { color: #fff; }
        .dd-tabs button.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: #635bff; }
        
        .btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .empty-state { text-align: center; color: #a0aab2; padding: 20px; font-size: 13px; }
        .text-center { text-align: center; }
      `}} />
    </div>
  );
}
