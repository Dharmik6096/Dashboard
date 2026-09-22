"use client";

import React, { useMemo, useState } from "react";
import { PortalPopover } from "./PortalPopover";

export interface RankingItem {
  id: string;
  name: string;
  value: number;
  label?: string; // Formatted value label, e.g. "13.0%" or "116 MB"
  tooltipData?: Record<string, string | number | undefined>;
}

export interface RankingPanelProps {
  title: string;
  context?: string;
  items: RankingItem[];
  color: string;
  maxItems?: number;
  onClick?: (item: RankingItem) => void;
  scaleMode?: "percent" | "relative"; // "percent" forces 0-100 scale. "relative" scales to max item.
}

export function RankingPanel({
  title, context, items, color, maxItems = 5, onClick, scaleMode = "percent"
}: RankingPanelProps) {
  
  const displayItems = items.slice(0, maxItems);
  
  const maxVal = useMemo(() => {
    if (scaleMode === "percent") return 100;
    if (displayItems.length === 0) return 100;
    return Math.max(...displayItems.map(d => d.value));
  }, [displayItems, scaleMode]);

  const [hoveredItem, setHoveredItem] = useState<{ id: string, x: number, y: number } | null>(null);

  return (
    <div className="panel-card" style={{ minHeight: 0, position: "relative" }}>
      <div className="panel-card-header">
        <div>{title}</div>
        {context && <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{context}</div>}
      </div>

      <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column" }}>

      {displayItems.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, minHeight: 100 }}>
          NO DATA
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
          {displayItems.map((item, i) => {
            const pct = maxVal > 0 ? Math.min((item.value / maxVal) * 100, 100) : 0;
            const barWidth = item.value > 0 && pct < 1 ? 1 : pct;
            const key = item.id || String(i);
            
            return (
              <div 
                key={key}
                id={`ranking-item-${key.replace(/[^a-zA-Z0-9]/g, '-')}`}
                onClick={() => onClick?.(item)}
                onMouseEnter={(e) => {
                  setHoveredItem({ id: key, x: 0, y: 0 });
                }}
                onMouseLeave={() => setHoveredItem(null)}
                style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: 6,
                  cursor: onClick ? "pointer" : "default",
                  transition: "background 0.2s",
                  padding: "4px 6px",
                  margin: "-4px -6px",
                  borderRadius: 6
                }}
                className={onClick ? "hover-bg-subtle" : ""}
              >
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, fontSize: 12, alignItems: "center" }}>
                  <span style={{ 
                    color: "var(--text-primary)", 
                    fontWeight: 500,
                    overflow: "hidden", 
                    textOverflow: "ellipsis", 
                    whiteSpace: "nowrap" 
                  }}>
                    {item.name}
                  </span>
                  <span style={{ 
                    color: "var(--text-primary)", 
                    fontWeight: 600, 
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "nowrap"
                  }}>
                    {item.label || item.value}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barWidth}%`, background: color, borderRadius: 3 }} />
                </div>

                {title !== "Top CPU Servers" && title !== "Top RAM Servers" && (
                <PortalPopover
                  isOpen={hoveredItem?.id === key && !!item.tooltipData}
                  onClose={() => {}}
                  anchorEl={document.getElementById(`ranking-item-${key.replace(/[^a-zA-Z0-9]/g, '-')}`)}
                  width={220}
                  placement="right"
                  offsetX={12}
                  offsetY={-10}
                >
                  <div style={{ padding: 4 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {item.tooltipData && Object.entries(item.tooltipData).map(([k, v]) => {
                        if (v === undefined || v === null) return null;
                        return (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, gap: 16 }}>
                            <span style={{ color: "var(--text-muted)" }}>{k}</span>
                            <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </PortalPopover>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
