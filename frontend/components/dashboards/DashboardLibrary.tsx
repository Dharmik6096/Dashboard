"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, LayoutDashboard, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";

import api from "@/lib/api";
import { canEditDashboards, DashboardSummary } from "@/lib/dashboard-types";
import { routes } from "@/lib/routes";
import styles from "./DashboardWorkspace.module.css";

type Draft = {
  title: string;
  description: string;
  default_time_range: string;
  refresh_interval_seconds: number;
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  default_time_range: "1h",
  refresh_interval_seconds: 30,
};

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error ? error.message : "Request failed";
}

export function DashboardLibrary() {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardResponse, identityResponse] = await Promise.all([
        api.get<DashboardSummary[]>("/dashboards"),
        api.get("/auth/me"),
      ]);
      setDashboards(dashboardResponse.data);
      setRole(identityResponse.data.workspace?.role || "viewer");
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dashboards;
    return dashboards.filter((dashboard) =>
      `${dashboard.title} ${dashboard.description || ""}`.toLowerCase().includes(needle),
    );
  }, [dashboards, query]);

  async function createDashboard(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.post<DashboardSummary>("/dashboards", draft);
      setDashboards((current) => [response.data, ...current]);
      setDraft(emptyDraft);
      setDialogOpen(false);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function removeDashboard(dashboard: DashboardSummary) {
    if (!window.confirm(`Delete “${dashboard.title}” and all of its panels?`)) return;
    try {
      await api.delete(`/dashboards/${dashboard.id}`);
      setDashboards((current) => current.filter((item) => item.id !== dashboard.id));
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const editable = canEditDashboards(role);

  return (
    <section className={styles.shell}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Dashboard workspace</span>
          <h1>Build focused operational views.</h1>
          <p>Create organization-scoped dashboards and compose panels from the read-only metrics already collected by DevOps Monitor.</p>
        </div>
        {editable ? (
          <button className={styles.primary} type="button" onClick={() => setDialogOpen(true)}>
            <Plus size={16} /> New dashboard
          </button>
        ) : <span className={styles.readonly}><ShieldCheck size={13} /> Viewer access</span>}
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.toolbar}>
        <label style={{ position: "relative", width: "min(420px, 100%)" }}>
          <Search size={15} style={{ position: "absolute", left: 13, top: 13, color: "var(--text-muted)" }} />
          <input className={styles.search} style={{ paddingLeft: 38 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dashboards" aria-label="Search dashboards" />
        </label>
        <span className={styles.count}>{visible.length} dashboard{visible.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className={styles.state} aria-live="polite"><strong>Loading dashboards…</strong><span>Reading your workspace configuration.</span></div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <LayoutDashboard size={30} />
          <strong>{dashboards.length ? "No dashboard matches your search" : "No dashboards yet"}</strong>
          <span>{dashboards.length ? "Try a different name or description." : editable ? "Create the first real dashboard for this workspace." : "An editor can create the first dashboard."}</span>
          {!dashboards.length && editable && <button className={styles.primary} type="button" onClick={() => setDialogOpen(true)}><Plus size={16} /> Create dashboard</button>}
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((dashboard) => (
            <div key={dashboard.id} style={{ position: "relative" }}>
              <Link href={routes.dashboard(dashboard.id)} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}><LayoutDashboard size={19} /></span>
                  <span className={styles.pill}>{dashboard.panel_count} panel{dashboard.panel_count === 1 ? "" : "s"}</span>
                </div>
                <div>
                  <h2>{dashboard.title}</h2>
                  <p>{dashboard.description || "No description provided."}</p>
                </div>
                <div className={styles.meta}>
                  <span className={styles.pill}><Clock3 size={11} /> {dashboard.default_time_range}</span>
                  <span className={styles.pill}>Refresh {dashboard.refresh_interval_seconds ? `${dashboard.refresh_interval_seconds}s` : "off"}</span>
                </div>
              </Link>
              {editable && <button className={styles.danger} type="button" aria-label={`Delete ${dashboard.title}`} onClick={() => void removeDashboard(dashboard)} style={{ position: "absolute", right: 14, bottom: 14, zIndex: 2 }}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDialogOpen(false); }}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-dashboard-title">
            <div className={styles.dialogHeader}>
              <div><h2 id="new-dashboard-title">Create dashboard</h2><p>Start with an empty, persisted workspace. Add panels after creation.</p></div>
              <button className={styles.iconButton} type="button" onClick={() => setDialogOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <form className={styles.form} onSubmit={createDashboard}>
              <label className={styles.field}>Name<input autoFocus required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label className={styles.field}>Description<textarea maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <div className={styles.formRow}>
                <label className={styles.field}>Default range<select value={draft.default_time_range} onChange={(event) => setDraft({ ...draft, default_time_range: event.target.value })}>{["15m", "1h", "6h", "24h", "7d", "30d"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className={styles.field}>Refresh<select value={draft.refresh_interval_seconds} onChange={(event) => setDraft({ ...draft, refresh_interval_seconds: Number(event.target.value) })}>{[[0, "Off"], [5, "5 seconds"], [10, "10 seconds"], [30, "30 seconds"], [60, "1 minute"], [300, "5 minutes"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              </div>
              <div className={styles.dialogActions}><button className={styles.secondary} type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button className={styles.primary} disabled={saving || !draft.title.trim()}>{saving ? "Creating…" : "Create dashboard"}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
