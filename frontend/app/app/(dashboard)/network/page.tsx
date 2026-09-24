"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, Server, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, XCircle, RefreshCw, Wifi, WifiOff, Search
} from 'lucide-react';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { api } from '@/lib/api';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-md)'
    }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
        {new Date(label).toLocaleTimeString()}
      </p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.name}: </span>
          <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
            {(p.value as number).toFixed(2)} MB/s
          </span>
        </div>
      ))}
    </div>
  );
};

import { useFilter } from '@/lib/FilterContext';

export default function NetworkDashboard() {
  const { envFilter, serverFilter } = useFilter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1h');
  const [refresh, setRefresh] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterface, setSelectedInterface] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError('');
    const startTime = Date.now();
    try {
      const params = new URLSearchParams({ period });
      if (envFilter && envFilter !== "all") params.append("env", envFilter);
      if (serverFilter && serverFilter !== "all") params.append("server_id", serverFilter);
      const res = await api.get('/network/dashboard', { params });
      setData(res.data);
    } catch (e) {
      console.error('Network API error:', e);
      setError('Network telemetry could not be loaded from the API.');
    } finally {
      setLoading(false);
      if (showSpinner) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 500 - elapsed);
        setTimeout(() => setRefreshing(false), remaining);
      } else {
        setRefreshing(false);
      }
    }
  }, [period, envFilter, serverFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(() => fetchData(), refresh * 1000);
    return () => clearInterval(interval);
  }, [period, refresh, fetchData]);

  const { summary, interfaces, top_consumers, history } = data || {};

  const filteredInterfaces = useMemo(() => {
    if (!interfaces) return [];
    if (!searchQuery) return interfaces;
    const lowerQuery = searchQuery.toLowerCase();
    return interfaces.filter((i: any) =>
      i.server_name.toLowerCase().includes(lowerQuery) ||
      i.interface.toLowerCase().includes(lowerQuery) ||
      i.ip_address.toLowerCase().includes(lowerQuery)
    );
  }, [interfaces, searchQuery]);

  const maxConsumerTraffic = top_consumers?.length
    ? Math.max(...top_consumers.map((t: any) => t.total_traffic))
    : 1;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── TOPBAR ── */}
      <header className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--font-title)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Network Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', margin: '4px 0 0 0' }}>
            Monitor recorded server network rates across your selected infrastructure scope.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="live-indicator live">
            <div className="live-dot" />
            LIVE
          </div>
          
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 'var(--font-sm)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="5m">Last 5m</option>
            <option value="15m">Last 15m</option>
            <option value="1h">Last 1h</option>
            <option value="6h">Last 6h</option>
            <option value="24h">Last 24h</option>
          </select>
          
          <select
            value={refresh}
            onChange={e => setRefresh(Number(e.target.value))}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 'var(--font-sm)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="10">Auto-refresh: 10s</option>
            <option value="30">Auto-refresh: 30s</option>
            <option value="60">Auto-refresh: 60s</option>
          </select>

          <button
            type="button"
            onClick={(e) => { e.preventDefault(); fetchData(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)', padding: '6px 12px',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: 'var(--font-sm)', transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {error ? <div role="alert" className="alert alert-error">{error} <button type="button" onClick={() => fetchData(true)}>Retry</button></div> : null}
        
        {loading && !data ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading network data...
          </div>
        ) : (
          <>
            {/* ── METRICS GRID ── */}
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-card-label">
                  <Server size={14} style={{ color: 'var(--color-blue)' }} /> Active Servers
                </div>
                <div className="metric-card-value">{summary?.active_servers ?? 0}</div>
                <div className="metric-card-sub">{summary?.total_servers ?? 0} total</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">
                  <Activity size={14} style={{ color: 'var(--color-purple)' }} /> Reporting Aggregates
                </div>
                <div className="metric-card-value">{summary?.active_interfaces ?? 0}</div>
                <div className="metric-card-sub">Server-level collectors</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">
                  <ArrowDownToLine size={14} style={{ color: 'var(--color-green)' }} /> Total RX
                </div>
                <div className="metric-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {(summary?.total_rx_MBps ?? 0).toFixed(1)} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>MB/s</span>
                </div>
                <div className="metric-card-sub">Incoming traffic</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">
                  <ArrowUpFromLine size={14} style={{ color: 'var(--color-blue)' }} /> Total TX
                </div>
                <div className="metric-card-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {(summary?.total_tx_MBps ?? 0).toFixed(1)} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>MB/s</span>
                </div>
                <div className="metric-card-sub">Outgoing traffic</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">
                  <AlertTriangle size={14} style={{ color: 'var(--color-critical)' }} /> Network Errors
                </div>
                <div className="metric-card-value" style={{ color: (summary?.network_errors ?? 0) > 0 ? 'var(--color-critical)' : 'var(--text-primary)' }}>
                  {summary?.network_errors ?? '—'}
                </div>
                <div className="metric-card-sub">Counter not collected</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">
                  <XCircle size={14} style={{ color: 'var(--color-warning)' }} /> Packet Drops
                </div>
                <div className="metric-card-value" style={{ color: (summary?.packet_drops ?? 0) > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                  {summary?.packet_drops ?? '—'}
                </div>
                <div className="metric-card-sub">Counter not collected</div>
              </div>
            </div>

            {/* ── CHARTS ROW ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              
              {/* Traffic Area Chart */}
              <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={16} style={{ color: 'var(--color-blue)' }} /> Network Traffic
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)' }} />
                      RX {(summary?.total_rx_MBps ?? 0).toFixed(1)} MB/s
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-blue)' }} />
                      TX {(summary?.total_tx_MBps ?? 0).toFixed(1)} MB/s
                    </div>
                  </div>
                </div>
                <div style={{ height: '300px', padding: '16px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history || []} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-green)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-green)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-blue)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-blue)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="var(--border)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      />
                      <YAxis
                        stroke="var(--border)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickFormatter={(v) => `${v.toFixed(0)}`}
                        width={40}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="rx" stroke="var(--color-green)" strokeWidth={2} fill="url(#rxGrad)" name="Incoming" />
                      <Area type="monotone" dataKey="tx" stroke="var(--color-blue)" strokeWidth={2} fill="url(#txGrad)" name="Outgoing" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Consumers Panel */}
              <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={16} style={{ color: 'var(--color-warning)' }} /> Top Consumers
                  </div>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {top_consumers?.length ? top_consumers.map((c: any, i: number) => {
                    const pct = maxConsumerTraffic > 0 ? (c.total_traffic / maxConsumerTraffic) * 100 : 0;
                    return (
                      <div key={c.server_id} 
                        style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background 0.2s' }} 
                        onClick={() => {
                          const intf = interfaces?.find((inf: any) => inf.server_id === c.server_id);
                          if (intf) setSelectedInterface(intf);
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.server_name}</span>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{c.total_traffic.toFixed(1)} MB/s</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-blue)', borderRadius: '3px' }} />
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
                      No traffic data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── INTERFACE HEALTH TABLE ── */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedInterface ? '2fr 1fr' : '1fr', gap: '24px' }}>
              <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wifi size={16} style={{ color: 'var(--color-healthy)' }} /> Interface Health
                </div>
                <div className="search-bar" style={{ maxWidth: '250px' }}>
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search interfaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Server</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Interface</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>IP Address</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>RX (MB/s)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>TX (MB/s)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Errors</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Drops</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInterfaces.length > 0 ? filteredInterfaces.map((intf: any) => (
                      <tr key={`${intf.server_id}-${intf.interface}`} onClick={() => setSelectedInterface(intf)} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer', background: selectedInterface?.server_id === intf.server_id ? 'var(--bg-hover)' : 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => { if (selectedInterface?.server_id !== intf.server_id) e.currentTarget.style.background = 'transparent'; }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>{intf.server_name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{intf.interface}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{intf.ip_address}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                            background: intf.status === 'UP' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: intf.status === 'UP' ? 'var(--color-healthy)' : 'var(--color-critical)',
                            border: `1px solid ${intf.status === 'UP' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            {intf.status === 'UP' ? <Wifi size={10} /> : <WifiOff size={10} />}
                            {intf.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{intf.rx.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{intf.tx.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{intf.errors ?? '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{intf.drops ?? '—'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No interfaces found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>
              
              {selectedInterface && (
                <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={16} style={{ color: 'var(--color-blue)' }} /> Interface Details
                    </div>
                    <button onClick={() => setSelectedInterface(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <XCircle size={16} />
                    </button>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Server', value: selectedInterface.server_name },
                      { label: 'Interface', value: selectedInterface.interface, mono: true },
                      { label: 'IP Address', value: selectedInterface.ip_address, mono: true },
                      { label: 'Status', value: null, badge: selectedInterface.status },
                      { label: 'RX', value: `${selectedInterface.rx.toFixed(2)} MB/s`, mono: true },
                      { label: 'TX', value: `${selectedInterface.tx.toFixed(2)} MB/s`, mono: true },
                      { label: 'Errors', value: selectedInterface.errors ?? 'Not collected' },
                      { label: 'Drops', value: selectedInterface.drops ?? 'Not collected' },
                      { label: 'MTU', value: selectedInterface.mtu ?? 'Not collected', mono: true },
                      { label: 'Last Seen', value: selectedInterface.last_seen ? new Date(selectedInterface.last_seen).toLocaleTimeString() : '–' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                        {row.badge ? (
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                            background: row.badge === 'UP' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: row.badge === 'UP' ? 'var(--color-healthy)' : 'var(--color-critical)',
                            border: `1px solid ${row.badge === 'UP' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            {row.badge === 'UP' ? <Wifi size={10} /> : <WifiOff size={10} />}
                            {row.badge}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-primary)', fontFamily: row.mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: 500 }}>
                            {row.value}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
