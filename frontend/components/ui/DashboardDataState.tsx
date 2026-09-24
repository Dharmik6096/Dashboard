"use client";

import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

type DashboardDataStateProps = {
  kind: "loading" | "error" | "empty" | "warning";
  title: string;
  description: string;
  onRetry?: () => void;
};

export function DashboardDataState({ kind, title, description, onRetry }: DashboardDataStateProps) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : Inbox;
  return (
    <div className={`dashboard-data-state is-${kind}`} role={kind === "error" ? "alert" : "status"} aria-live="polite" aria-busy={kind === "loading"}>
      <Icon size={22} className={kind === "loading" ? "spin" : undefined} aria-hidden="true" />
      <div><strong>{title}</strong><span>{description}</span></div>
      {(kind === "error" || kind === "warning") && onRetry ? <button type="button" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" />Try again</button> : null}
    </div>
  );
}
