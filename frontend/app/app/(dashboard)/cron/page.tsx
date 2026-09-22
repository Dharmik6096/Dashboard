"use client";
import { routes } from "@/lib/routes";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, Search, Server, Clock, 
  PlayCircle, StopCircle, 
  Terminal, ShieldCheck, ChevronRight, ChevronDown,
  Calendar, FileCode, Copy, Check, FileText,
  AlertCircle, Cpu, LayoutGrid
} from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';

// Helper for parsing cron expressions into human readable strings
function humanizeCron(expr: string) {
  if (expr === '@reboot') return 'At startup';
  if (expr === '@hourly') return 'Every hour';
  if (expr === '@daily' || expr === '@midnight') return 'Every day at midnight';
  if (expr === '@weekly') return 'Every Sunday';
  if (expr === '@monthly') return 'Every month';
  if (expr === '@yearly' || expr === '@annually') return 'Every year';
  
  const parts = expr.split(' ');
  if (parts.length < 5) return 'Custom Schedule';
  
  if (parts[0] === '*' && parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') return 'Every minute';
  if (parts[0].startsWith('*/') && parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') return `Every ${parts[0].split('/')[1]} minutes`;
  if (parts[0] === '0' && parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') return 'Every hour on the hour';
  if (parts[0] === '0' && parts[1].startsWith('*/') && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') return `Every ${parts[1].split('/')[1]} hours`;
  
  return 'Custom Schedule';
}

function parseNextRun(expr: string) {
    if (expr.startsWith('@')) return 'Next cycle';
    return 'Pending computation...';
}

export default function CronPage() {
  const [data, setData] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [serverFilter, setServerFilter] = useState("all-servers");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [sourceFilter, setSourceFilter] = useState("all-sources");
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dropdown states
  const [serverDropOpen, setServerDropOpen] = useState(false);
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const [sourceDropOpen, setSourceDropOpen] = useState(false);

  const fetchServers = async () => {
    try {
      const res = await api.get('/servers');
      setServers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCronJobs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (serverFilter !== "all-servers") params.append("server_id", serverFilter);
      if (statusFilter !== "all-status") {
        if (statusFilter === 'active') params.append("status", "active");
        if (statusFilter === 'disabled') params.append("status", "disabled");
      }

      const res = await api.get(`/cron?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCronJobs();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, serverFilter, statusFilter, sourceFilter]);

  const jobs = data?.cron_jobs || [];
  
  const filteredJobs = useMemo(() => {
    return jobs.filter((job: any) => {
      if (sourceFilter === 'all-sources') return true;
      if (sourceFilter === 'user') return job.source_type === 'user_crontab';
      if (sourceFilter === 'system') return job.source_type === 'crontab_system' || job.source_type === 'cron_d';
      return true;
    });
  }, [jobs, sourceFilter]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeJobsCount = (data?.summary?.total_jobs || 0) - (data?.summary?.disabled || 0);

  // Custom Inline Metric Card to match design tokens
  const renderMetricCard = (label: string, value: any, Icon: any, color: string) => (
    <div className="metric-card" style={{ height: 110 }}>
      <div className="metric-card-label">
        <Icon size={14} style={{ color: `var(--${color})` }} />
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="metric-card-value" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {loading ? <span style={{ opacity: 0.5 }}>--</span> : value}
        {!loading && label === 'Active Schedules' && value > 0 && (
          <span style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: 'var(--color-healthy)', 
            boxShadow: '0 0 8px var(--color-healthy)', 
            animation: 'pulse-dot 2s infinite' 
          }} />
        )}
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Hero Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 'var(--radius-full)', color: 'var(--color-purple)', fontSize: 'var(--font-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            <Clock size={12} />
            Automation Hub
          </div>
          <h1 style={{ fontSize: 'var(--font-title)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            Cron Scheduler
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-md)', margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
            Enterprise-grade visualization of scheduled tasks across all infrastructure. Monitor cron configurations, active schedules, and background jobs with precision.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: 8, borderRadius: 'var(--radius-md)' }}>
            <ShieldCheck size={20} color="var(--color-purple)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>System Visibility</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Global Auditing Active</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {renderMetricCard('Total Jobs', data?.summary?.total_jobs || 0, LayoutGrid, 'color-blue')}
        {renderMetricCard('Active Schedules', activeJobsCount, PlayCircle, 'color-healthy')}
        {renderMetricCard('Disabled', data?.summary?.disabled || 0, StopCircle, 'color-warning')}
        {renderMetricCard('Servers Queried', data?.summary?.servers_fetched || 0, Server, 'color-purple')}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              placeholder="Search commands, users..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-blue)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          {/* Server Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => { setServerDropOpen(!serverDropOpen); setStatusDropOpen(false); setSourceDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 160 }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>
                {serverFilter === 'all-servers' ? 'All Servers' : servers.find(s => s.id === serverFilter)?.name || 'All Servers'}
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {serverDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4 }}>
                <div 
                  onClick={() => { setServerFilter('all-servers'); setServerDropOpen(false); }}
                  style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: serverFilter === 'all-servers' ? 'var(--bg-hover)' : 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = serverFilter === 'all-servers' ? 'var(--bg-hover)' : 'transparent'}
                >
                  All Servers
                </div>
                {servers.map((s: any) => (
                  <div 
                    key={s.id}
                    onClick={() => { setServerFilter(s.id); setServerDropOpen(false); }}
                    style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: serverFilter === s.id ? 'var(--bg-hover)' : 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = serverFilter === s.id ? 'var(--bg-hover)' : 'transparent'}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => { setStatusDropOpen(!statusDropOpen); setServerDropOpen(false); setSourceDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 140 }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>
                {statusFilter === 'all-status' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {statusDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4 }}>
                {['all-status', 'active', 'disabled'].map(opt => (
                  <div 
                    key={opt}
                    onClick={() => { setStatusFilter(opt); setStatusDropOpen(false); }}
                    style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: statusFilter === opt ? 'var(--bg-hover)' : 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = statusFilter === opt ? 'var(--bg-hover)' : 'transparent'}
                  >
                    {opt === 'all-status' ? 'All Status' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => { setSourceDropOpen(!sourceDropOpen); setServerDropOpen(false); setStatusDropOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-sm)', cursor: 'pointer', minWidth: 160 }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>
                {sourceFilter === 'all-sources' ? 'All Sources' : sourceFilter === 'user' ? 'User Crontabs' : 'System (/etc/cron)'}
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>
            {sourceDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-floating)', zIndex: 100, padding: 4 }}>
                {[
                  { id: 'all-sources', label: 'All Sources' },
                  { id: 'user', label: 'User Crontabs' },
                  { id: 'system', label: 'System (/etc/cron)' }
                ].map(opt => (
                  <div 
                    key={opt.id}
                    onClick={() => { setSourceFilter(opt.id); setSourceDropOpen(false); }}
                    style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', cursor: 'pointer', borderRadius: 4, background: sourceFilter === opt.id ? 'var(--bg-hover)' : 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = sourceFilter === opt.id ? 'var(--bg-hover)' : 'transparent'}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
            <Clock size={12} />
            {data?.sampled_at ? `Synced: ${new Date(data.sampled_at).toLocaleTimeString()}` : 'Not synced'}
          </span>
          <button 
            onClick={fetchCronJobs}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-blue)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background 0.2s' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--color-blue-dim)' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--color-blue)' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Sync Jobs
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 40, padding: '12px 16px' }}></th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Server</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Schedule</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Frequency</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Command</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>User</th>
                <th style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading cron jobs...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 80, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <AlertCircle size={32} color="var(--text-muted)" />
                      <p style={{ margin: 0, fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>No cron jobs found</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>Adjust your filters to see more results.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job: any, i: number) => {
                  const rowId = `${job.server_id}-${i}`;
                  const isExpanded = expandedRow === rowId;
                  
                  return (
                    <React.Fragment key={rowId}>
                      <tr 
                        onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                        style={{ borderBottom: '1px solid var(--border)', background: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '16px' }}>
                          <ChevronRight size={16} color={isExpanded ? 'var(--color-blue)' : 'var(--text-muted)'} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </td>
                        <td style={{ padding: '16px', fontSize: 'var(--font-sm)' }}>
                          <Link href={routes.server(job.server_id)} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-blue)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}>
                            <Cpu size={14} color="var(--text-muted)" />
                            {job.server_name}
                          </Link>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: job.is_disabled ? 'var(--text-muted)' : 'var(--color-blue)', fontWeight: 500 }}>
                            {job.schedule}
                          </span>
                        </td>
                        <td style={{ padding: '16px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                          {humanizeCron(job.schedule)}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }} title={job.command}>
                            {job.command}
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {job.user}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {job.is_disabled ? (
                            <span style={{ fontSize: '11px', background: 'transparent', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: 'var(--radius-full)', color: 'var(--text-muted)', fontWeight: 600 }}>
                              Disabled
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '4px 10px', borderRadius: 'var(--radius-full)', color: 'var(--color-healthy)', fontWeight: 600 }}>
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{ padding: '24px 32px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                                
                                {/* Left Column */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                                      <Terminal size={14} color="var(--color-blue)" /> Execution Command
                                    </div>
                                    <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16, position: 'relative' }}>
                                      <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-healthy)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingRight: 40 }}>
                                        <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>$ </span>
                                        {job.command}
                                      </pre>
                                      <button 
                                        onClick={() => handleCopy(job.command, rowId)}
                                        style={{ position: 'absolute', top: 12, right: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                      >
                                        {copiedId === rowId ? <Check size={14} color="var(--color-healthy)" /> : <Copy size={14} />}
                                      </button>
                                    </div>
                                    {job.comment && (
                                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg-input)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <AlertCircle size={14} color="var(--text-muted)" style={{ marginTop: 2 }} />
                                        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{job.comment}</div>
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                        <FileCode size={12} color="var(--color-purple)" /> Config Source
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                                          <FileText size={14} color="var(--text-muted)" />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={job.source}>{job.source}</span>
                                        </div>
                                        <span style={{ fontSize: '9px', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, border: '1px solid var(--border)' }}>
                                          {job.source_type.replace('_', ' ')}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                        <Calendar size={12} color="var(--color-healthy)" /> Next Execution
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                                        <Clock size={14} color="var(--text-muted)" />
                                        {parseNextRun(job.schedule)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Right Column */}
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                                    <LayoutGrid size={14} color="var(--color-warning)" /> Schedule Matrix
                                  </div>
                                  <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20, height: 'calc(100% - 30px)', boxSizing: 'border-box' }}>
                                    {job.schedule.startsWith('@') ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, textAlign: 'center' }}>
                                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Clock size={28} color="var(--color-warning)" />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 4 }}>{job.schedule}</div>
                                          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{humanizeCron(job.schedule)}</div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {[
                                          { label: 'Minute', val: job.schedule.split(' ')[0], desc: '0-59' },
                                          { label: 'Hour', val: job.schedule.split(' ')[1], desc: '0-23' },
                                          { label: 'Day of Month', val: job.schedule.split(' ')[2], desc: '1-31' },
                                          { label: 'Month', val: job.schedule.split(' ')[3], desc: '1-12' },
                                          { label: 'Day of Week', val: job.schedule.split(' ')[4], desc: '0-7' },
                                        ].map((part, idx) => (
                                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-subtle)' }} />
                                              <div>
                                                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{part.label}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{part.desc}</div>
                                              </div>
                                            </div>
                                            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-blue)', minWidth: 40, textAlign: 'center' }}>
                                              {part.val || '-'}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
