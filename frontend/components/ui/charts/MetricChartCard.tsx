import React from "react";
import { TimeSeriesChart, TimeSeriesDataPoint, ChartEvent } from "./TimeSeriesChart";
import { TimeRangeSelector, TimeRange } from "./TimeRangeSelector";

interface MetricChartCardProps {
  title: string;
  data: TimeSeriesDataPoint[];
  series: {
    key: string;
    name: string;
    color: string;
    type?: "line" | "area";
  }[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  syncId?: string;
  thresholds?: { value: number; label: string; color: string }[];
  events?: ChartEvent[];
  height?: number;
  formatValue?: (val: number) => string;
  valueSuffix?: string;
  liveStatus?: "LIVE" | "STALE" | "UNKNOWN";
  className?: string;
}

export function MetricChartCard({
  title, data, series, timeRange, onTimeRangeChange, syncId,
  thresholds, events, height = 300, formatValue, valueSuffix, liveStatus, className = ""
}: MetricChartCardProps) {
  return (
    <div className={`card ${className}`} style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
        <h3 className="card-title" style={{ margin: 0, fontSize: "var(--font-lg)" }}>{title}</h3>
        <TimeRangeSelector 
          value={timeRange} 
          onChange={onTimeRangeChange} 
          liveStatus={liveStatus}
        />
      </div>
      <TimeSeriesChart
        data={data}
        series={series}
        title=""
        syncId={syncId}
        thresholds={thresholds}
        events={events}
        height={height}
        formatValue={formatValue}
        valueSuffix={valueSuffix}
        isAnimationActive={liveStatus === "LIVE"}
      />
    </div>
  );
}
