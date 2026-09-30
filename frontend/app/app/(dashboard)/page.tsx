"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Server as ServerIcon, AlertTriangle, Cpu, MemoryStick, HardDrive, Network, Activity } from "lucide-react";
import api from "@/lib/api";
import { TimeSeriesChart, Sparkline } from "@/components/ui/charts";
import { formatPercent } from "@/lib/formatters";

interface DashboardData {
  stats: {
    servers: number; servers_online: number;
    avg_cpu: number; avg_ram: number; avg_disk: number;
    alerts: number; alerts_critical: number;
  };
  top_consumers: {
    cpu_servers: { id: string; name: string; value: number }[];
    ram_servers: { id: string; name: string; value: number }[];
  };
  recent_alerts: {
    id: string; severity: string; server_name: string;
    metric: string; message: string; created_at: string;
  }[];
  history: { time: string; cpu?: number; ram?: number; load?: number; rx?: number; tx?: number }[];
}

export default function DashboardOverview() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("1h");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/overview/dashboard?period=${period}&_t=${Date.now()}`);
      setData(res.data);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !data) {
    return <div className="dd-loading">Loading Infrastructure Overview…</div>;
  }
  
  if (error && !data) {
    return <div className="dd-error">{error}</div>;
  }
  
  if (!data) return null;

  return (
    <div className="dd-dashboard">
      <div className="dd-header">
        <h1>Infrastructure Overview</h1>
        <div className="dd-controls">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="dd-select">
            <option value="15m">Past 15 Minutes</option>
            <option value="1h">Past 1 Hour</option>
            <option value="4h">Past 4 Hours</option>
            <option value="1d">Past 1 Day</option>
          </select>
        </div>
      </div>

      <div className="dd-top-widgets">
        <Widget 
          title="Total Servers" 
          value={data.stats.servers} 
          sub={`${data.stats.servers_online} online`} 
          icon={ServerIcon}
        />
        <Widget 
          title="Avg CPU Usage" 
          value={formatPercent(data.stats.avg_cpu)} 
          sparkline={data.history} 
          dataKey="cpu" 
          color="#fa709a"
          icon={Cpu}
        />
        <Widget 
          title="Avg Memory Usage" 
          value={formatPercent(data.stats.avg_ram)} 
          sparkline={data.history} 
          dataKey="ram" 
          color="#4b42e8"
          icon={MemoryStick}
        />
        <Widget 
          title="Active Alerts" 
          value={data.stats.alerts} 
          sub={`${data.stats.alerts_critical} critical`} 
          color={data.stats.alerts > 0 ? "#f59e0b" : "#64687a"}
          icon={AlertTriangle}
        />
      </div>

      <div className="dd-timeseries-grid">
        <div className="dd-panel">
          <div className="dd-panel-title"><Cpu size={14} /> CPU Usage (%)</div>
          <div className="dd-panel-body">
            <TimeSeriesChart data={data.history} lines={[{ key: "cpu", name: "CPU", color: "#fa709a" }]} />
          </div>
        </div>
        <div className="dd-panel">
          <div className="dd-panel-title"><MemoryStick size={14} /> Memory Usage (%)</div>
          <div className="dd-panel-body">
            <TimeSeriesChart data={data.history} lines={[{ key: "ram", name: "RAM", color: "#4b42e8" }]} />
          </div>
        </div>
        <div className="dd-panel">
          <div className="dd-panel-title"><Activity size={14} /> System Load</div>
          <div className="dd-panel-body">
            <TimeSeriesChart data={data.history} lines={[{ key: "load", name: "Load", color: "#f59e0b" }]} />
          </div>
        </div>
        <div className="dd-panel">
          <div className="dd-panel-title"><Network size={14} /> Network Traffic</div>
          <div className="dd-panel-body">
            <TimeSeriesChart data={data.history} lines={[
              { key: "rx", name: "Inbound", color: "#0ea5c8" },
              { key: "tx", name: "Outbound", color: "#635bff" }
            ]} />
          </div>
        </div>
      </div>

      <div className="dd-bottom-lists">
        <div className="dd-panel">
          <div className="dd-panel-title">Top CPU Consumers</div>
          <div className="dd-panel-body nopad">
            <table className="dd-table">
              <tbody>
                {data.top_consumers.cpu_servers.map((s, i) => (
                  <tr key={s.id || i} onClick={() => router.push(`/app/servers/${s.id}`)}>
                    <td>{s.name}</td>
                    <td className="text-right num">{formatPercent(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="dd-panel">
          <div className="dd-panel-title">Top Memory Consumers</div>
          <div className="dd-panel-body nopad">
            <table className="dd-table">
              <tbody>
                {data.top_consumers.ram_servers.map((s, i) => (
                  <tr key={s.id || i} onClick={() => router.push(`/app/servers/${s.id}`)}>
                    <td>{s.name}</td>
                    <td className="text-right num">{formatPercent(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dd-panel">
          <div className="dd-panel-title">Recent Alerts</div>
          <div className="dd-panel-body nopad">
            <table className="dd-table">
              <tbody>
                {data.recent_alerts.slice(0,5).map((a, i) => (
                  <tr key={a.id || i}>
                    <td style={{ color: a.severity === "critical" ? "#ef4444" : "#f59e0b" }}>■</td>
                    <td>{a.server_name}</td>
                    <td>{a.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .dd-dashboard { padding: 24px; color: #f0f0f0; }
        .dd-loading, .dd-error { padding: 40px; text-align: center; color: #a0aab2; }
        .dd-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .dd-header h1 { font-size: 20px; font-weight: 700; margin: 0; }
        .dd-select { background: #161821; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 12px; border-radius: 4px; font-size: 13px; outline: none; }
        
        .dd-top-widgets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
        .dd-widget { background: #11121a; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 16px; display: flex; flex-direction: column; }
        .dd-widget-title { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a0aab2; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
        .dd-widget-body { display: flex; align-items: flex-end; justify-content: space-between; flex: 1; }
        .dd-widget-val { font-size: 28px; font-weight: 700; line-height: 1; }
        .dd-widget-sub { font-size: 12px; color: #64687a; margin-top: 4px; }
        .dd-widget-spark { width: 40%; height: 28px; }
        
        .dd-timeseries-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .dd-bottom-lists { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        
        .dd-panel { background: #11121a; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; display: flex; flex-direction: column; overflow: hidden; }
        .dd-panel-title { padding: 12px 16px; font-size: 13px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px; }
        .dd-panel-body { padding: 16px; height: 220px; }
        .dd-panel-body.nopad { padding: 0; height: auto; }
        
        .dd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .dd-table tr { border-bottom: 1px solid rgba(255,255,255,0.02); cursor: pointer; transition: background 0.1s; }
        .dd-table tr:hover { background: rgba(255,255,255,0.03); }
        .dd-table tr:last-child { border-bottom: none; }
        .dd-table td { padding: 10px 16px; }
        .dd-table td.num { font-family: monospace; font-size: 14px; }
        .text-right { text-align: right; }
      `}} />
    </div>
  );
}

function Widget({ title, value, sub, sparkline, dataKey, color, icon: Icon }: any) {
  return (
    <div className="dd-widget">
      <div className="dd-widget-title"><Icon size={14} /> {title}</div>
      <div className="dd-widget-body">
        <div>
          <div className="dd-widget-val" style={{ color: color || '#fff' }}>{value}</div>
          {sub && <div className="dd-widget-sub">{sub}</div>}
        </div>
        {sparkline && dataKey && (
          <div className="dd-widget-spark">
            <Sparkline data={sparkline} dataKey={dataKey} color={color || '#fff'} />
          </div>
        )}
      </div>
    </div>
  );
}
