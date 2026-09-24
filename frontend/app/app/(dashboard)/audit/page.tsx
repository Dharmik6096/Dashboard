"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

import { DashboardDataState } from "@/components/ui/DashboardDataState";
import api from "@/lib/api";

type Entry = { id: string; action: string; actor: string; resource_type: string | null; resource_id: string | null; ip_address: string | null; created_at: string };

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setEntries((await api.get<Entry[]>("/organizations/audit-log")).data); }
    catch { setError("The audit API did not return workspace activity."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? entries.filter((entry) => `${entry.action} ${entry.actor} ${entry.resource_type || ""}`.toLowerCase().includes(normalized)) : entries;
  }, [entries, query]);

  return <div className="v2-workspace-page">
    <header className="v2-page-head"><div><span>Security &amp; governance</span><h1>Audit log</h1><p>Review recorded identity, billing, and workspace changes.</p></div><span className="v2-page-trust"><ShieldCheck size={15} />Security event history</span></header>
    <section className="v2-section-block"><div className="v2-section-title"><div><h2>Recent activity</h2><p>Up to 250 of the most recent recorded events are returned by the API.</p></div><label className="v2-table-search"><Search size={14} /><span className="sr-only">Filter activity</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter activity" /></label></div>
      {loading ? <DashboardDataState kind="loading" title="Loading audit events" description="Reading the latest recorded workspace activity." />
        : error ? <DashboardDataState kind="error" title="Audit log unavailable" description={error} onRetry={load} />
          : shown.length === 0 ? <DashboardDataState kind="empty" title={query ? "No events match this filter" : "No audit events recorded"} description={query ? "Try a broader action, actor, or resource name." : "Security-sensitive workspace activity will appear here."} />
            : <div className="v2-table audit"><div className="v2-table-head"><span>Action</span><span>Actor</span><span>Resource</span><span>IP address</span><span>Time</span></div>{shown.map((entry) => <div className="v2-table-row" key={entry.id}><span><strong>{entry.action}</strong></span><span>{entry.actor}</span><span>{entry.resource_type || "workspace"}{entry.resource_id ? ` · ${entry.resource_id.slice(0, 8)}` : ""}</span><span>{entry.ip_address || "—"}</span><span>{new Date(entry.created_at).toLocaleString()}</span></div>)}</div>}
    </section>
  </div>;
}
