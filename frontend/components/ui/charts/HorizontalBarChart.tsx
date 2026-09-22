"use client";
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

export interface BarDataPoint {
  name: string;
  value: number;
  [key: string]: string | number | undefined;
}

interface HorizontalBarChartProps {
  data: BarDataPoint[];
  title: string;
  dataKey?: string;
  nameKey?: string;
  color?: string;
  height?: number;
  formatValue?: (val: number) => string;
  valueSuffix?: string;
}

export function HorizontalBarChart({
  data, title, dataKey = "value", nameKey = "name", color = "var(--color-blue)", height = 300, formatValue, valueSuffix = ""
}: HorizontalBarChartProps) {
  
  const defaultFormatter = (val: number) => {
    if (formatValue) return formatValue(val);
    if (val > 1000) return (val / 1000).toFixed(1) + "k" + valueSuffix;
    return val.toFixed(1) + valueSuffix;
  };

  if (!data || data.length === 0) {
    return (
      <div className="panel" style={{ height: height + 60, display: "flex", flexDirection: "column" }}>
        <h3 className="card-title">{title}</h3>
        <div className="empty-state" style={{ flex: 1, padding: 0 }}>
          <div className="empty-state-title">No Data</div>
          <div className="empty-state-desc">No ranking data available.</div>
        </div>
      </div>
    );
  }

  // Sort data descending by value
  const sortedData = [...data].sort((a, b) => Number(b[dataKey] ?? 0) - Number(a[dataKey] ?? 0));

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px" }}>
      <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
      
      <div style={{ 
        width: "100%", height, 
        background: "rgba(0,0,0,0.15)", 
        borderRadius: "8px", 
        border: "1px solid rgba(255,255,255,0.02)", 
        boxShadow: "inset 0 4px 12px rgba(0,0,0,0.4)",
        paddingTop: "16px"
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
            <XAxis 
              type="number" 
              stroke="var(--text-muted)" 
              fontSize={13} 
              tickFormatter={defaultFormatter}
            />
            <YAxis 
              type="category" 
              dataKey={nameKey}
              stroke="var(--text-muted)" 
              fontSize={13} 
              width={100}
              tick={{ fill: "var(--text-secondary)" }}
            />
              <Tooltip 
                cursor={{ fill: "var(--bg-hover)" }}
                contentStyle={{ 
                  backgroundColor: "var(--bg-elevated)", 
                  borderColor: "var(--border)", 
                  borderRadius: 8,
                  boxShadow: "var(--shadow-floating)",
                  backdropFilter: "blur(4px)"
                }}
                labelStyle={{ color: "var(--text-primary)", fontSize: 14, marginBottom: 8, fontWeight: 600 }}
              itemStyle={{ fontSize: 15, fontFamily: "var(--font-mono)", fontWeight: 500 }}
              formatter={(val) => [defaultFormatter(Number(val ?? 0)), ""]}
            />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={String(entry.color || color)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
