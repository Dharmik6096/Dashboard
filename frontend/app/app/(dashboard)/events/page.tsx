"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Activity, RefreshCw, Server, AlertCircle, Info, ShieldAlert, CheckCircle2, Box, Webhook, Clock, Terminal, ChevronDown, Search, Calendar, Database } from "lucide-react";
import api from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";
import { DashboardDataState } from "@/components/ui/DashboardDataState";
import { useFilter } from "@/lib/FilterContext";

interface GlobalEvent {
  id: string;
  timestamp: string;
  server_id: string;
  server_name?: string;
  source: string;
  source_type: string;
  event_type: string;
  severity: string;
  title: string;
  details?: string;
}

const severityConfig: Record<string, { color: string, icon: React.FC<any>, bg: string }> = {
  info: { color: "var(--info)", bg: "rgba(59, 130, 246, 0.1)", icon: Info },
  warning: { color: "var(--warning)", bg: "rgba(245, 158, 11, 0.1)", icon: AlertCircle },
  critical: { color: "var(--danger)", bg: "rgba(239, 68, 68, 0.1)", icon: ShieldAlert },
  success: { color: "var(--success)", bg: "rgba(16, 185, 129, 0.1)", icon: CheckCircle2 }
};

const sourceIconConfig: Record<string, React.FC<any>> = {
  container: Box,
  nginx: Webhook,
  cron: Clock,
  service: Terminal,
  alert: ShieldAlert,
  server: Server,
  database: Database,
  default: Activity
};

export default function EventsPage() {
  const { envFilter, serverFilter } = useFilter();
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ limit: "200" });
      if (sourceFilter !== "all") params.set("source_type", sourceFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (envFilter !== "all") params.set("env", envFilter);
      if (serverFilter !== "all") params.set("server_id", serverFilter);

      const res = await api.get(`/events?${params.toString()}`);
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      setError("The events API could not return the current timeline.");
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, severityFilter, envFilter, serverFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const lowerQ = searchQuery.toLowerCase();
    return events.filter(e => 
      e.title.toLowerCase().includes(lowerQ) || 
      e.source_type.toLowerCase().includes(lowerQ) ||
      (e.details && e.details.toLowerCase().includes(lowerQ))
    );
  }, [events, searchQuery]);

  // Group events by Date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, GlobalEvent[]> = {};
    filteredEvents.forEach(e => {
      const d = new Date(e.timestamp);
      const dateKey = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    return groups;
  }, [filteredEvents]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 60, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--primary-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
              <Activity size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Global Events Timeline</h1>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>Recorded infrastructure and container lifecycle events</p>
            </div>
          </div>
        </div>
        <button className="btn" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} onClick={loadEvents}>
          <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh Data
        </button>
      </div>

      {/* Filters Section */}
      <div className="card" style={{ marginBottom: 24, padding: 20, display: "flex", flexDirection: "column", gap: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          
          {/* Search */}
          <div style={{ flex: "1 1 300px", position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: 12, color: "var(--text-secondary)" }} />
            <input 
              type="text" 
              placeholder="Search events by title, detail or source..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", padding: "10px 16px 10px 40px", borderRadius: 8, color: "var(--text-primary)", outline: "none" }}
            />
          </div>

          <div style={{ width: 1, height: 32, background: "var(--border)", display: "none" }} className="hide-on-mobile" />

          {/* Severity Filters */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {["all", "info", "warning", "critical"].map(s => {
              const isActive = severityFilter === s;
              return (
                <button 
                  key={s} 
                  onClick={() => setSeverityFilter(s)}
                  style={{ 
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
                    background: isActive ? (severityConfig[s]?.bg || "var(--primary-glow)") : "transparent",
                    color: isActive ? (severityConfig[s]?.color || "var(--primary)") : "var(--text-secondary)",
                    border: `1px solid ${isActive ? (severityConfig[s]?.color || "var(--primary)") : "var(--border)"}`,
                    transition: "all 0.2s ease"
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Source Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", paddingRight: 8 }}>Sources:</span>
          {["all", "container", "nginx", "service", "port", "cron"].map(s => {
            const isActive = sourceFilter === s;
            const Icon = sourceIconConfig[s] || sourceIconConfig.default;
            return (
              <button 
                key={s} 
                onClick={() => setSourceFilter(s)}
                style={{ 
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: isActive ? "var(--bg-hover)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  border: "none",
                  transition: "all 0.2s ease"
                }}
              >
                {s !== "all" && <Icon size={14} />}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline Section */}
      {loading ? (
        <div className="card" style={{ padding: 60 }}><LoadingState /></div>
      ) : error ? (
        <div className="card"><DashboardDataState kind="error" title="Events unavailable" description={error} onRetry={loadEvents} /></div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState title="No Events Found" desc="No events match your current criteria." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {Object.entries(groupedEvents).map(([dateLabel, dateEvents]) => (
            <div key={dateLabel} className="timeline-group">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ padding: "6px 12px", background: "var(--bg-hover)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>
                  <Calendar size={16} /> {dateLabel}
                </div>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingLeft: 12 }}>
                {dateEvents.map((e, idx) => {
                  const conf = severityConfig[e.severity] || severityConfig.info;
                  const Icon = conf.icon;
                  const SourceIcon = sourceIconConfig[e.source_type] || sourceIconConfig.default;
                  const isExpanded = expandedId === e.id;
                  
                  return (
                    <div key={e.id} style={{ display: "flex", gap: 20, position: "relative" }}>
                      {/* Timeline Line */}
                      {idx !== dateEvents.length - 1 && (
                        <div style={{ position: "absolute", left: 19, top: 40, bottom: -16, width: 2, background: "var(--border)", zIndex: 0 }} />
                      )}
                      
                      {/* Timeline Dot/Icon */}
                      <div style={{ 
                        width: 40, height: 40, borderRadius: "50%", background: conf.bg, color: conf.color, 
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1,
                        border: `2px solid var(--surface)`, outline: `1px solid ${conf.color}`
                      }}>
                        <Icon size={18} />
                      </div>

                      {/* Event Content */}
                      <div 
                        style={{ 
                          flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, 
                          overflow: "hidden", transition: "all 0.3s ease",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                        }}
                      >
                        <div 
                          onClick={() => toggleExpand(e.id)}
                          style={{ 
                            padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", 
                            cursor: "pointer", gap: 16
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                              <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                                {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                                <SourceIcon size={12} /> {e.source_type.toUpperCase()}
                              </span>
                              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                Server: {e.server_name || e.server_id.split("-")[0]}
                              </span>
                              {e.source !== e.source_type && e.source !== "docker" && (
                                <>
                                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                                  <span style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {e.source}
                                  </span>
                                </>
                              )}
                            </div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                              {e.title}
                            </h3>
                          </div>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: conf.bg, color: conf.color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {e.event_type}
                            </span>
                            <div style={{ color: "var(--text-secondary)", transition: "transform 0.3s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {isExpanded && e.details && (
                          <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
                            <div style={{ marginTop: 16 }}>
                              <h4 style={{ margin: "0 0 8px 0", fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Event Details</h4>
                              <pre style={{ 
                                margin: 0, padding: 16, background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", 
                                fontSize: 13, color: "var(--text-primary)", overflowX: "auto", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)"
                              }}>
                                {typeof e.details === 'object' ? JSON.stringify(e.details, null, 2) : e.details}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
