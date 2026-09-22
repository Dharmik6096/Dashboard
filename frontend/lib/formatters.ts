/**
 * Central safe formatting utilities.
 * All user-visible metric display MUST go through these helpers.
 * Never show undefined / null / NaN / negative values directly to users.
 */

const NA = "N/A";

/** Safely format a number as a percentage string. Returns N/A for invalid values. */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return NA;
  return `${Math.max(0, value).toFixed(decimals)}%`;
}

/** Format bytes to human readable. Returns N/A for invalid values. */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return NA;
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(decimals)} ${units[index]}`;
}

/** Format bytes/s rate. Returns N/A for invalid values. */
export function formatRate(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return NA;
  return `${formatBytes(bytes, decimals)}/s`;
}

/** Format load average. Returns N/A for invalid values. */
export function formatLoad(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return NA;
  return Math.max(0, value).toFixed(2);
}

/** Format uptime seconds to human-readable string. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return NA;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Format a last-seen timestamp to a relative string (e.g. "3s ago", "2m ago"). */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Format an ISO timestamp to locale string. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NA;
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return NA;
  }
}

/** Format ISO to time-only string (HH:MM:SS IST). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return NA;
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  } catch {
    return NA;
  }
}

/** Safely get a value, returning a fallback if null/undefined/NaN. */
export function safeValue<T>(value: T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && isNaN(value)) return fallback;
  return value;
}

/** Get status color CSS variable for a numeric metric. */
export function metricColor(value: number, warn = 70, crit = 90): string {
  if (value >= crit) return "var(--color-red)";
  if (value >= warn) return "var(--color-yellow)";
  return "var(--color-green)";
}

/** Get bar class for a numeric metric. */
export function barClass(value: number, warn = 70, crit = 90): string {
  if (value >= crit) return "bar-red";
  if (value >= warn) return "bar-yellow";
  return "bar-green";
}

/** Determine if agent data is stale (>60 seconds). */
export function isStale(lastSeen: string | null | undefined, thresholdSeconds = 60): boolean {
  if (!lastSeen) return true;
  const diff = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  return diff > thresholdSeconds;
}

/** Capitalize first letter. */
export function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
