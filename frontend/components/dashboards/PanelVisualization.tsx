"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "@/lib/api";
import { DashboardPanel, PanelMetricData } from "@/lib/dashboard-types";
import styles from "./DashboardWorkspace.module.css";

const colors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#22d3ee"];

function formatValue(value: number | null | undefined, unit?: string | null, decimals = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}${unit || ""}`;
}

function timeLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PanelVisualization({
  dashboardId,
  panel,
  timeRange,
  refreshSeconds,
}: {
  dashboardId: string;
  panel: DashboardPanel;
  timeRange: string;
  refreshSeconds: number;
}) {
  const [data, setData] = useState<PanelMetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get<PanelMetricData>(
        `/dashboards/${dashboardId}/panels/${panel.id}/data`,
        { params: { time_range: timeRange } },
      );
      setData(response.data);
      setError(null);
    } catch {
      setError("Metric data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [dashboardId, panel.id, timeRange]);

  useEffect(() => {
    setLoading(true);
    void load();
    if (!refreshSeconds) return;
    const timer = window.setInterval(() => void load(), refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [load, refreshSeconds]);

  const rows = useMemo(() => {
    const merged = new Map<string, Record<string, string | number | null>>();
    for (const series of data?.series || []) {
      for (const point of series.points) {
        const row = merged.get(point.time) || { time: point.time };
        row[series.key] = point.value;
        merged.set(point.time, row);
      }
    }
    return [...merged.values()].sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }, [data]);

  if (loading) return <div className={styles.metricState} aria-live="polite">Loading real metrics…</div>;
  if (error) return <div className={styles.metricError} role="alert">{error}</div>;
  if (!data?.series.length || !rows.length) {
    return <div className={styles.metricState}>No collected data in the selected {timeRange} range.</div>;
  }

  const decimals = panel.display_options.decimals;
  const latest = data.series.flatMap((series) => series.points).filter((point) => point.value != null).at(-1)?.value;
  if (panel.visualization === "stat" || panel.visualization === "gauge") {
    return (
      <div className={styles.statValue}>
        <strong>{formatValue(latest, panel.unit, decimals)}</strong>
        <span>{panel.aggregation}({panel.metric_name}) · {timeRange}</span>
      </div>
    );
  }

  if (panel.visualization === "table") {
    return (
      <div className={styles.metricTableWrap}>
        <table className={styles.metricTable}>
          <thead><tr><th>Time</th>{data.series.map((series) => <th key={series.key}>{series.label}</th>)}</tr></thead>
          <tbody>{rows.slice(-12).reverse().map((row) => <tr key={String(row.time)}><td>{timeLabel(String(row.time))}</td>{data.series.map((series) => <td key={series.key}>{formatValue(row[series.key] as number | null, panel.unit, decimals)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }

  const Chart = panel.visualization === "bar" ? BarChart : LineChart;
  return (
    <div className={styles.chart} aria-label={`${panel.title} metric chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
          <XAxis dataKey="time" tickFormatter={timeLabel} minTickGap={28} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(label) => new Date(String(label)).toLocaleString()} formatter={(value) => formatValue(Number(value), panel.unit, decimals)} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
          {data.series.map((series, index) => panel.visualization === "bar"
            ? <Bar key={series.key} dataKey={series.key} name={series.label} fill={colors[index % colors.length]} radius={[3, 3, 0, 0]} />
            : <Line key={series.key} dataKey={series.key} name={series.label} stroke={colors[index % colors.length]} strokeWidth={2} dot={panel.display_options.show_points} connectNulls={false} isAnimationActive={false} />)}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
