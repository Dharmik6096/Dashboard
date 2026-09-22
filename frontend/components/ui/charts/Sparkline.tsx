import React from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";

interface SparklineProps {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
  height?: number;
  width?: number | string;
}

export function Sparkline({ data, dataKey, color = "var(--color-healthy)", height = 30, width = "100%" }: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ height, width, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", height: "2px", background: "var(--border)", opacity: 0.3, borderRadius: 2 }} />
    </div>;
  }

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
