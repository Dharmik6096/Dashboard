import React from "react";

export type TimeRange = "LIVE" | "5m" | "15m" | "1h" | "6h" | "24h" | "7d" | "30d";

export const TIME_RANGES: TimeRange[] = ["LIVE", "5m", "15m", "1h", "6h", "24h", "7d", "30d"];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  liveStatus?: "LIVE" | "STALE" | "UNKNOWN";
  className?: string;
}

export function TimeRangeSelector({ value, onChange, liveStatus, className = "" }: TimeRangeSelectorProps) {
  return (
    <div className={`filter-bar ${className}`} style={{ gap: 4, marginBottom: 0 }}>
      {TIME_RANGES.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`filter-chip ${value === range ? "active" : ""}`}
          style={{ padding: "4px 10px", fontSize: 13, border: value === range ? "none" : "1px solid var(--border-subtle)" }}
        >
          {range === "LIVE" && value === "LIVE" && liveStatus ? (
            <span style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: 6,
              color: liveStatus === "LIVE" ? "inherit" : (liveStatus === "STALE" ? "var(--color-warning)" : "var(--color-muted)")
            }}>
              <span className={`live-dot ${liveStatus === "LIVE" ? "pulse" : ""}`} style={{
                background: liveStatus === "LIVE" ? "#fff" : "currentColor"
              }}></span>
              {range}
            </span>
          ) : (
            range
          )}
        </button>
      ))}
    </div>
  );
}
