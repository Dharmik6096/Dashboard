"use client";
import React, { useMemo } from "react";
import { TimeSeriesChart, TimeSeriesDataPoint, ChartEvent } from "./TimeSeriesChart";

interface GraphPanelProps {
  title: string;
  data: TimeSeriesDataPoint[];
  series: {
    key: string;
    name: string;
    color: string;
  }[];
  syncId?: string;
  height?: number;
  onClick?: () => void;
  formatValue?: (val: number) => string;
  valueSuffix?: string;
  thresholds?: { value: number; label: string; color: string }[];
  events?: ChartEvent[];
  yAxisWidth?: number;
}

export function GraphPanel({
  title, data, series, syncId, height = 230, onClick, formatValue, valueSuffix = "", thresholds, events, yAxisWidth
}: GraphPanelProps) {
  
  const stats = useMemo(() => {
    if (!data.length) return {};
    const last = data[data.length - 1];
    const s: Record<string, { current: number; avg: number; max: number }> = {};
    
    series.forEach(se => {
      const values = data.map(d => Number(d[se.key])).filter(v => !isNaN(v));
      if (!values.length) return;
      const current = Number(last[se.key]) || 0;
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      s[se.key] = { current, avg, max };
    });
    return s;
  }, [data, series]);

  const defaultFormatter = (val: number) => {
    if (formatValue) return formatValue(val);
    if (val > 1000) return (val / 1000).toFixed(1) + "k" + valueSuffix;
    return val.toFixed(1) + valueSuffix;
  };

  return (
    <div 
      className="chart-card clickable" 
      onClick={onClick}
      style={{ minHeight: height + 80, cursor: "pointer" }}
    >
      <div className="chart-card-header">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>{title}</h3>
        
        <div style={{ display: "flex", gap: 24 }}>
          {series.length === 1 ? (
            // Single series header
            <div style={{ display: "flex", gap: 16, fontSize: 14, fontFamily: "var(--font-mono)" }}>
              {stats[series[0].key] && (
                <>
                  <div><span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 6 }}>CUR</span> <span style={{ color: "var(--color-blue)", fontWeight: 600 }}>{defaultFormatter(stats[series[0].key].current)}</span></div>
                  <div><span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 6 }}>AVG</span> <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{defaultFormatter(stats[series[0].key].avg)}</span></div>
                  <div><span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 6 }}>MAX</span> <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{defaultFormatter(stats[series[0].key].max)}</span></div>
                </>
              )}
            </div>
          ) : (
            // Multi series header (e.g. Network RX / TX)
            <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto", columnGap: 16, rowGap: 4, fontSize: 13, fontFamily: "var(--font-mono)" }}>
              <div />
              <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>CURRENT</div>
              <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>AVG</div>
              <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}>MAX</div>
              {series.map(s => {
                const stat = stats[s.key];
                if (!stat) return null;
                return (
                  <React.Fragment key={s.key}>
                    <div style={{ color: s.color, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center" }}>{s.name}</div>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{defaultFormatter(stat.current)}</div>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{defaultFormatter(stat.avg)}</div>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{defaultFormatter(stat.max)}</div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="chart-card-body" style={{ flex: 1, minHeight: height, position: "relative" }}>
        <TimeSeriesChart 
          title=""
          data={data} 
          series={series} 
          syncId={syncId} 
          height={height}
          formatValue={formatValue}
          valueSuffix={valueSuffix}
          thresholds={thresholds}
          events={events}
          yAxisWidth={yAxisWidth}
        />
      </div>
    </div>
  );
}
