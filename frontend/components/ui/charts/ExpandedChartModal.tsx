"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock } from "lucide-react";
import { TimeSeriesChart, TimeSeriesDataPoint, ChartEvent } from "./TimeSeriesChart";
import api from "@/lib/api";

interface ExpandedChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  metricKey: string;
  metricName: string;
  color: string;
  serverId: string;
  envFilter: string;
  formatValue?: (val: number) => string;
  valueSuffix?: string;
  alerts?: { id: string; alert: string; created_at: string }[];
  events?: { id: string; event: string; time: string }[];
}

export function ExpandedChartModal({
  isOpen, onClose, title, metricKey, metricName, color, serverId, envFilter, formatValue, valueSuffix = "", alerts, events
}: ExpandedChartModalProps) {
  
  const [period, setPeriod] = useState("1h");
  const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const isLive = period === "LIVE";
  // Convert "LIVE" to standard backend period "1h" for querying, but refresh frequently
  const queryPeriod = isLive ? "1h" : period; 

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // We rely on the overview dashboard endpoint for aggregated history
      const res = await api.get(`/overview/dashboard?period=${queryPeriod}&env=${envFilter}&server_id=${serverId}`);
      setData(res.data.history || []);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [queryPeriod, envFilter, serverId]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadData();
    }
  }, [isOpen, loadData]);

  useEffect(() => {
    if (isOpen && isLive) {
      const iv = setInterval(loadData, 5000);
      return () => clearInterval(iv);
    }
  }, [isOpen, isLive, loadData]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    
    // Support multi-series for network if metricKey has comma separated values like "rx,tx"
    // But for simplicity, the ExpandedChartModal will handle a single metric or dual explicitly.
    const keys = metricKey.split(",");
    
    // We will just calculate stats for the primary key (keys[0]) for the stats bar
    const primaryKey = keys[0];
    
    const values = data.map((d: any) => Number(d[primaryKey])).filter(v => !isNaN(v));
    if (!values.length) return null;

    const current = Number(data[data.length - 1][primaryKey]) || 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Find peak timestamp
    const peakPoint = data.find((d: any) => Number(d[primaryKey]) === max);
    const peakTime = peakPoint ? new Date(peakPoint.time) : null;

    return { current, avg, min, max, peakTime, count: values.length };
  }, [data, metricKey]);

  const defaultFormatter = (val: number) => {
    if (formatValue) return formatValue(val);
    if (val > 1000) return (val / 1000).toFixed(1) + "k" + valueSuffix;
    return val.toFixed(1) + valueSuffix;
  };

  const chartSeries = useMemo(() => {
    const keys = metricKey.split(",");
    if (keys.length > 1 && keys.includes("tx")) {
      return [
        { key: "rx", name: "RX", color: "var(--color-teal)", type: "area" as const },
        { key: "tx", name: "TX", color: "var(--color-pink)", type: "area" as const }
      ];
    }
    return [{ key: metricKey, name: metricName, color, type: "area" as const }];
  }, [metricKey, metricName, color]);

  // Map alerts/events to chart events
  const chartEvents = useMemo(() => {
    const arr: ChartEvent[] = [];
    if (alerts) {
      alerts.forEach(a => {
        // Very basic mapping, if alert time matches history time roughly
        arr.push({ time: a.created_at, label: `Alert: ${a.alert}`, color: "var(--color-critical)" });
      });
    }
    if (events) {
      events.forEach(e => {
        arr.push({ time: e.time, label: `Event: ${e.event}`, color: "var(--color-blue)" });
      });
    }
    return arr;
  }, [alerts, events]);

  if (!isOpen) return null;

  const freshness = isLive ? "● LIVE" : `Data as of ${lastUpdate.toLocaleTimeString()}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 24
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              width: "85vw", maxWidth: 1200, height: "80vh", maxHeight: 800,
              background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              display: "flex", flexDirection: "column", overflow: "hidden"
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: "20px 32px", display: "flex", justifyContent: "space-between", 
              alignItems: "center", borderBottom: "1px solid var(--border-subtle)" 
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                  {title} <span style={{ color: "var(--text-muted)", fontSize: 16, fontWeight: 500, marginLeft: 8 }}>{serverId === 'all' ? 'All Servers' : serverId}</span>
                </h2>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: "transparent", border: "none", color: "var(--text-muted)", 
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 8, borderRadius: "50%"
                }}
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "24px 32px", gap: 24, minHeight: 0 }}>
              
              {/* Stats Row */}
              {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto) 1fr", gap: 48, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>CURRENT</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {defaultFormatter(stats.current)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>AVERAGE</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {defaultFormatter(stats.avg)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>MINIMUM</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {defaultFormatter(stats.min)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>MAXIMUM</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {defaultFormatter(stats.max)}
                    </div>
                  </div>
                </div>
              )}

              {/* Controls Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {["LIVE", "5m", "15m", "1h", "6h", "24h", "7d"].map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      style={{
                        padding: "6px 12px", fontSize: 12, fontWeight: 600,
                        background: period === p ? "var(--bg-elevated)" : "transparent",
                        color: period === p ? "var(--text-primary)" : "var(--text-muted)",
                        border: `1px solid ${period === p ? "var(--border)" : "transparent"}`,
                        borderRadius: "var(--radius-md)", cursor: "pointer",
                        boxShadow: period === p ? "var(--shadow-floating)" : "none",
                        transition: "all 0.2s"
                      }}
                    >
                      {p === "LIVE" ? <span style={{ color: "var(--color-critical)", marginRight: 4 }}>●</span> : null}
                      {p}
                    </button>
                  ))}
                </div>
                
                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 16 }}>
                  {stats && <span>Samples: {stats.count}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} /> {freshness}
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                {loading && data.length === 0 ? (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    Loading...
                  </div>
                ) : (
                  <TimeSeriesChart 
                    title=""
                    data={data}
                    series={chartSeries}
                    syncId="expanded"
                    height={400}
                    formatValue={formatValue}
                    valueSuffix={valueSuffix}
                    events={chartEvents}
                    isAnimationActive={isLive}
                  />
                )}
              </div>

              {/* Footer */}
              {stats && stats.peakTime && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Peak: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{defaultFormatter(stats.max)}</span> — {stats.peakTime.toLocaleTimeString()}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
