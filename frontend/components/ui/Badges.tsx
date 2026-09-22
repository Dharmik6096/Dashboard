import React from "react";
import { formatLastSeen } from "@/lib/formatters";

export function StatusBadge({ status, text }: { status: string, text?: string }) {
  const normalized = status.toLowerCase();
  
  let bg = "var(--bg-hover)";
  let color = "var(--text-secondary)";
  let border = "var(--border-subtle)";

  if (normalized === "online" || normalized === "running" || normalized === "active" || normalized === "healthy") {
    bg = "rgba(16,185,129,0.1)";
    color = "var(--color-healthy)";
    border = "var(--color-healthy)";
  } else if (normalized === "offline" || normalized === "stopped" || normalized === "exited" || normalized === "critical") {
    bg = "rgba(239,68,68,0.1)";
    color = "var(--color-critical)";
    border = "var(--color-critical)";
  } else if (normalized === "warning" || normalized === "degraded" || normalized === "paused") {
    bg = "rgba(245,158,11,0.1)";
    color = "var(--color-warning)";
    border = "var(--color-warning)";
  } else if (normalized === "info") {
    bg = "rgba(59,130,246,0.1)";
    color = "var(--color-blue)";
    border = "var(--color-blue)";
  }

  return (
    <span className="badge" style={{ background: bg, color, border: `1px solid ${border}` }}>
      {(text || status).toUpperCase()}
    </span>
  );
}

export function FreshnessBadge({ date, text, style }: { date: string | Date | null, text?: string, style?: React.CSSProperties }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  if (!date) return <span style={{ color: "var(--text-muted)", fontSize: 13, ...style }}>Unknown</span>;
  
  const d = new Date(date);
  const diffSec = now ? (now - d.getTime()) / 1000 : 0;
  
  let color = "var(--color-healthy)";
  if (diffSec > 300) color = "var(--color-warning)"; // > 5 mins
  if (diffSec > 900) color = "var(--color-critical)"; // > 15 mins

  return (
    <span style={{ fontSize: 13, color, ...style }}>
      {text ? `${text} ` : ""}{formatLastSeen(typeof date === "string" ? date : date.toISOString())}
    </span>
  );
}
