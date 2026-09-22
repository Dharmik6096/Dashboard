"use client";
import React, { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from "recharts";

export interface TimeSeriesDataPoint {
  time: string;
  [key: string]: string | number | undefined;
}

export interface ChartEvent {
  time: string;
  label: string;
  color?: string;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  series: {
    key: string;
    name: string;
    color: string;
    type?: "line" | "area";
  }[];
  title: string;
  syncId?: string;
  thresholds?: { value: number; label: string; color: string }[];
  events?: ChartEvent[];
  height?: number;
  formatValue?: (val: number) => string;
  valueSuffix?: string;
  yAxisWidth?: number;
  isAnimationActive?: boolean;
}

export function TimeSeriesChart({
  data, series, title, syncId, thresholds, events, height = 300, formatValue, valueSuffix = "", yAxisWidth = 60, isAnimationActive = false
}: TimeSeriesChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };



  const defaultFormatter = (val: number) => {
    if (formatValue) return formatValue(val);
    if (val > 1000) return (val / 1000).toFixed(1) + "k" + valueSuffix;
    return val.toFixed(1) + valueSuffix;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.1)", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.1)" }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>No Data Available</div>
        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>Waiting for metrics to arrive...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, width: "100%", height: "100%" }}>
      
      <div style={{ 
        width: "100%", height, 
        background: "rgba(0,0,0,0.15)", 
        borderRadius: "8px", 
        border: "1px solid rgba(255,255,255,0.02)", 
        boxShadow: "inset 0 4px 12px rgba(0,0,0,0.4)",
        paddingTop: "16px"
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId={syncId} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {series.map(s => (
                <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickMargin={10}
              tickFormatter={(val) => {
                const d = new Date(val);
                return isNaN(d.getTime()) ? val : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }}
            />
            <YAxis 
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickFormatter={defaultFormatter}
              width={yAxisWidth}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{ 
                backgroundColor: "rgba(20, 20, 25, 0.95)", 
                borderColor: "rgba(255,255,255,0.1)", 
                borderRadius: 8,
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                padding: "8px 12px"
              }}
              labelStyle={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 8, fontWeight: 600 }}
              itemStyle={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, padding: "2px 0" }}
              formatter={(val: unknown, name: unknown) => [defaultFormatter(Number(val)), String(name)]}
              labelFormatter={(label: unknown) => {
                const d = new Date(String(label));
                return isNaN(d.getTime()) ? String(label) : d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
              }}
            />
            
            {thresholds?.map((t, i) => (
              <ReferenceLine key={`thresh-${i}`} y={t.value} stroke={t.color} strokeDasharray="4 4" 
                label={{ position: 'insideTopLeft', value: t.label, fill: t.color, fontSize: 11, offset: 10 }} />
            ))}
            
            {events?.map((e, i) => (
              <ReferenceLine key={`event-${i}`} x={e.time} stroke={e.color || "var(--color-blue)"} 
                label={{ position: 'insideTopRight', value: e.label, fill: e.color || "var(--color-blue)", fontSize: 11 }} />
            ))}

            {series.map(s => !hiddenSeries.has(s.key) && (
              <Area 
                key={s.key}
                type="monotone" 
                dataKey={s.key} 
                name={s.name}
                stroke={s.color} 
                strokeWidth={2}
                fill={`url(#grad-${s.key})`} 
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={isAnimationActive}
                connectNulls={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend below chart */}
      {series.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
          {series.map(s => {
            const isHidden = hiddenSeries.has(s.key);
            return (
              <div 
                key={s.key} 
                onClick={() => toggleSeries(s.key)}
                style={{ 
                  display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
                  cursor: "pointer", opacity: isHidden ? 0.4 : 1, transition: "opacity 0.2s"
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                {s.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
