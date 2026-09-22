import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
}

export function DonutChart({ data, centerLabel, centerValue, height = 200 }: DonutChartProps) {
  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="85%"
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "4px" }}
            itemStyle={{ color: "var(--text-primary)", fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {(centerValue || centerLabel) && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none"
        }}>
          {centerValue && <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{centerValue}</div>}
          {centerLabel && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}
