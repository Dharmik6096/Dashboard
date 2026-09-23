"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Edit3, Gauge, LineChart, Plus, Save, ShieldCheck, SlidersHorizontal, Table2, Trash2, X } from "lucide-react";

import api from "@/lib/api";
import { canEditDashboards, DashboardDetail, DashboardFolder, DashboardPanel, DashboardVariable } from "@/lib/dashboard-types";
import { routes } from "@/lib/routes";
import { PanelVisualization } from "./PanelVisualization";
import styles from "./DashboardWorkspace.module.css";

const metricCatalog = {
  server_metrics: ["cpu_percent", "ram_percent", "load_1", "net_rx_rate", "net_tx_rate"],
  container_metrics: ["cpu_percent", "mem_percent", "net_rx_rate", "net_tx_rate", "block_read_rate", "block_write_rate", "pids"],
  disk_metrics: ["use_percent", "used_bytes", "free_bytes"],
} as const;

type MetricSource = keyof typeof metricCatalog;
type PanelDraft = {
  title: string;
  description: string;
  visualization: DashboardPanel["visualization"];
  metric_source: MetricSource;
  metric_name: string;
  aggregation: DashboardPanel["aggregation"];
  unit: string;
  width: number;
  height: number;
  filter_variable: string;
};

const emptyPanel = (): PanelDraft => ({
  title: "",
  description: "",
  visualization: "time_series",
  metric_source: "server_metrics",
  metric_name: "cpu_percent",
  aggregation: "avg",
  unit: "%",
  width: 12,
  height: 6,
  filter_variable: "",
});

type VariableDraft = {
  name: string;
  label: string;
  variable_type: DashboardVariable["variable_type"];
  options: string;
  default_value: string;
};

const emptyVariable: VariableDraft = { name: "", label: "", variable_type: "custom", options: "", default_value: "" };

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error ? error.message : "Request failed";
}

function visualIcon(type: DashboardPanel["visualization"]) {
  if (type === "gauge" || type === "stat") return Gauge;
  if (type === "bar") return BarChart3;
  if (type === "table") return Table2;
  return LineChart;
}

export function DashboardEditor({ dashboardId }: { dashboardId: string }) {
  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("viewer");
  const [panelDialog, setPanelDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [variableDialog, setVariableDialog] = useState(false);
  const [editingPanel, setEditingPanel] = useState<DashboardPanel | null>(null);
  const [panelDraft, setPanelDraft] = useState<PanelDraft>(emptyPanel());
  const [settingsDraft, setSettingsDraft] = useState({ title: "", description: "", default_time_range: "1h", refresh_interval_seconds: 30, folder_id: "" });
  const [saving, setSaving] = useState(false);
  const [variableDraft, setVariableDraft] = useState<VariableDraft>(emptyVariable);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<DashboardFolder[]>([]);
  const [editingVariable, setEditingVariable] = useState<DashboardVariable | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardResponse, folderResponse, identityResponse] = await Promise.all([
        api.get<DashboardDetail>(`/dashboards/${dashboardId}`),
        api.get<DashboardFolder[]>("/dashboards/folders"),
        api.get("/auth/me"),
      ]);
      setDashboard(dashboardResponse.data);
      setSettingsDraft({
        title: dashboardResponse.data.title,
        description: dashboardResponse.data.description || "",
        default_time_range: dashboardResponse.data.default_time_range,
        refresh_interval_seconds: dashboardResponse.data.refresh_interval_seconds,
        folder_id: dashboardResponse.data.folder_id || "",
      });
      setFolders(folderResponse.data);
      setRole(identityResponse.data.workspace?.role || "viewer");
      setVariableValues(Object.fromEntries(dashboardResponse.data.variables.map((variable) => [variable.name, variable.default_value || variable.options[0]?.value || ""])));
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => { void load(); }, [load]);

  const editable = canEditDashboards(role);
  const nextY = useMemo(() => Math.max(0, ...(dashboard?.panels.map((panel) => panel.grid_position.y + panel.grid_position.height) || [0])), [dashboard?.panels]);

  function openNewPanel() {
    setEditingPanel(null);
    setPanelDraft(emptyPanel());
    setPanelDialog(true);
  }

  function openPanel(panel: DashboardPanel) {
    setEditingPanel(panel);
    setPanelDraft({
      title: panel.title,
      description: panel.description || "",
      visualization: panel.visualization,
      metric_source: panel.metric_source,
      metric_name: panel.metric_name,
      aggregation: panel.aggregation,
      unit: panel.unit || "",
      width: panel.grid_position.width,
      height: panel.grid_position.height,
      filter_variable: panel.query_config.server_variable || panel.query_config.container_variable || panel.query_config.mount_point_variable || "",
    });
    setPanelDialog(true);
  }

  async function savePanel(event: FormEvent) {
    event.preventDefault();
    if (!dashboard) return;
    setSaving(true);
    const payload = {
      title: panelDraft.title,
      description: panelDraft.description || null,
      visualization: panelDraft.visualization,
      metric_source: panelDraft.metric_source,
      metric_name: panelDraft.metric_name,
      aggregation: panelDraft.aggregation,
      unit: panelDraft.unit || null,
      query_config: {
        ...(editingPanel?.query_config || { server_id: null, container_id: null, mount_point: null, group_by: "none" }),
        server_variable: panelDraft.metric_source === "server_metrics" ? panelDraft.filter_variable || null : null,
        container_variable: panelDraft.metric_source === "container_metrics" ? panelDraft.filter_variable || null : null,
        mount_point_variable: panelDraft.metric_source === "disk_metrics" ? panelDraft.filter_variable || null : null,
      },
      grid_position: {
        x: editingPanel?.grid_position.x || 0,
        y: editingPanel?.grid_position.y ?? nextY,
        width: panelDraft.width,
        height: panelDraft.height,
      },
      display_options: editingPanel?.display_options || { color: null, decimals: 1, show_legend: true, show_points: false },
      sort_order: editingPanel?.sort_order ?? dashboard.panels.length,
    };
    try {
      const response = editingPanel
        ? await api.patch<DashboardPanel>(`/dashboards/${dashboard.id}/panels/${editingPanel.id}`, payload)
        : await api.post<DashboardPanel>(`/dashboards/${dashboard.id}/panels`, payload);
      setDashboard((current) => current ? {
        ...current,
        panels: editingPanel
          ? current.panels.map((panel) => panel.id === response.data.id ? response.data : panel)
          : [...current.panels, response.data],
        panel_count: editingPanel ? current.panel_count : current.panel_count + 1,
      } : current);
      setPanelDialog(false);
      setEditingPanel(null);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function removePanel(panel: DashboardPanel) {
    if (!dashboard || !window.confirm(`Delete panel “${panel.title}”?`)) return;
    try {
      await api.delete(`/dashboards/${dashboard.id}/panels/${panel.id}`);
      setDashboard({ ...dashboard, panels: dashboard.panels.filter((item) => item.id !== panel.id), panel_count: dashboard.panel_count - 1 });
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!dashboard) return;
    setSaving(true);
    try {
      const response = await api.patch<DashboardDetail>(`/dashboards/${dashboard.id}`, { ...settingsDraft, folder_id: settingsDraft.folder_id || null });
      setDashboard({ ...dashboard, ...response.data });
      setSettingsDialog(false);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function createVariable(event: FormEvent) {
    event.preventDefault();
    if (!dashboard) return;
    const options = variableDraft.options.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [label, ...valueParts] = line.split("=");
      const value = valueParts.length ? valueParts.join("=").trim() : label.trim();
      return { label: label.trim(), value };
    });
    if (!options.length) return setError("Add at least one variable option.");
    setSaving(true);
    try {
      const payload = {
        name: variableDraft.name,
        label: variableDraft.label,
        variable_type: variableDraft.variable_type,
        options,
        default_value: variableDraft.default_value || options[0].value,
        sort_order: dashboard.variables.length,
      };
      const response = editingVariable
        ? await api.patch<DashboardVariable>(`/dashboards/${dashboard.id}/variables/${editingVariable.id}`, {
            label: payload.label,
            variable_type: payload.variable_type,
            options: payload.options,
            default_value: payload.default_value,
            sort_order: editingVariable.sort_order,
          })
        : await api.post<DashboardVariable>(`/dashboards/${dashboard.id}/variables`, payload);
      setDashboard({ ...dashboard, variables: editingVariable
        ? dashboard.variables.map((item) => item.id === response.data.id ? response.data : item)
        : [...dashboard.variables, response.data] });
      setVariableValues((current) => ({ ...current, [response.data.name]: response.data.default_value || response.data.options[0].value }));
      setVariableDraft(emptyVariable);
      setEditingVariable(null);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function editVariable(variable: DashboardVariable) {
    setEditingVariable(variable);
    setVariableDraft({
      name: variable.name,
      label: variable.label,
      variable_type: variable.variable_type,
      options: variable.options.map((option) => `${option.label}=${option.value}`).join("\n"),
      default_value: variable.default_value || "",
    });
  }

  async function removeVariable(variable: DashboardVariable) {
    if (!dashboard || !window.confirm(`Delete variable “${variable.label}”?`)) return;
    try {
      await api.delete(`/dashboards/${dashboard.id}/variables/${variable.id}`);
      setDashboard({ ...dashboard, variables: dashboard.variables.filter((item) => item.id !== variable.id) });
      setVariableValues((current) => { const next = { ...current }; delete next[variable.name]; return next; });
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  if (loading) return <div className={styles.state} aria-live="polite"><strong>Loading dashboard…</strong><span>Reading panels and layout.</span></div>;
  if (!dashboard) return <div className={styles.state}><strong>Dashboard unavailable</strong><span>{error || "This dashboard does not exist in your workspace."}</span><Link className={styles.secondary} href={routes.dashboards}>Back to dashboards</Link></div>;

  return (
    <section className={styles.shell}>
      <div className={styles.editorHeader}>
        <div>
          <Link className={styles.back} href={routes.dashboards}><ArrowLeft size={14} /> All dashboards</Link>
          <span className={styles.eyebrow}>Persisted dashboard</span>
          <h1>{dashboard.title}</h1>
          <p>{dashboard.description || "No description provided."} · {dashboard.default_time_range} range · {dashboard.refresh_interval_seconds ? `${dashboard.refresh_interval_seconds}s refresh` : "manual refresh"}</p>
        </div>
        <div className={styles.headerActions}>
          {editable ? <>
            <button className={styles.secondary} type="button" onClick={() => setSettingsDialog(true)}><Edit3 size={15} /> Settings</button>
            <button className={styles.primary} type="button" onClick={openNewPanel}><Plus size={15} /> Add panel</button>
          </> : <span className={styles.readonly}><ShieldCheck size={13} /> Viewer access</span>}
        </div>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.notice}><ShieldCheck size={15} /> Panel definitions are read-only metric queries. They cannot run shell commands or change monitored servers.</div>

      <div className={styles.variableBar} aria-label="Dashboard variables">
        <SlidersHorizontal size={15} />
        {dashboard.variables.length ? dashboard.variables.map((variable) => <label key={variable.id}><span>{variable.label}</span><select value={variableValues[variable.name] || ""} onChange={(event) => setVariableValues((current) => ({ ...current, [variable.name]: event.target.value }))}>{variable.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>) : <span>No variables configured</span>}
        {editable && <button className={styles.secondary} type="button" onClick={() => setVariableDialog(true)}>Manage variables</button>}
      </div>

      {dashboard.panels.length === 0 ? (
        <div className={styles.empty}>
          <LayoutDashboardIcon />
          <strong>No panels configured</strong>
          <span>{editable ? "Add a panel and select a permitted metric source." : "An editor can add the first panel."}</span>
          {editable && <button className={styles.primary} type="button" onClick={openNewPanel}><Plus size={16} /> Add first panel</button>}
        </div>
      ) : (
        <div className={styles.panelGrid}>
          {dashboard.panels.map((panel) => {
            const Icon = visualIcon(panel.visualization);
            return <article className={styles.panel} key={panel.id} style={{ gridColumn: `${panel.grid_position.x + 1} / span ${panel.grid_position.width}`, minHeight: Math.max(190, panel.grid_position.height * 32) }}>
              <div className={styles.panelHeader}>
                <div><h2>{panel.title}</h2><p>{panel.visualization.replace("_", " ")} · {panel.aggregation}</p></div>
                {editable && <div className={styles.panelActions}><button className={styles.iconButton} type="button" onClick={() => openPanel(panel)} aria-label={`Edit ${panel.title}`}><Edit3 size={13} /></button><button className={styles.iconButton} type="button" onClick={() => void removePanel(panel)} aria-label={`Delete ${panel.title}`}><Trash2 size={13} /></button></div>}
              </div>
              <div className={styles.panelBody}>
                <span className={styles.metricKind}><Icon size={13} /> {panel.metric_source}</span>
                <PanelVisualization dashboardId={dashboard.id} panel={panel} timeRange={dashboard.default_time_range} refreshSeconds={dashboard.refresh_interval_seconds} variableValues={variableValues} />
              </div>
            </article>;
          })}
        </div>
      )}

      {panelDialog && (
        <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setPanelDialog(false); }}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="panel-dialog-title">
            <div className={styles.dialogHeader}><div><h2 id="panel-dialog-title">{editingPanel ? "Edit panel" : "Add panel"}</h2><p>Select from metrics already collected by the read-only agent.</p></div><button className={styles.iconButton} type="button" onClick={() => setPanelDialog(false)} aria-label="Close"><X size={16} /></button></div>
            <form className={styles.form} onSubmit={savePanel}>
              <label className={styles.field}>Panel name<input autoFocus required maxLength={160} value={panelDraft.title} onChange={(event) => setPanelDraft({ ...panelDraft, title: event.target.value })} /></label>
              <label className={styles.field}>Description<textarea maxLength={2000} value={panelDraft.description} onChange={(event) => setPanelDraft({ ...panelDraft, description: event.target.value })} /></label>
              <div className={styles.formRow}>
                <label className={styles.field}>Visualization<select value={panelDraft.visualization} onChange={(event) => setPanelDraft({ ...panelDraft, visualization: event.target.value as PanelDraft["visualization"] })}>{["time_series", "stat", "gauge", "bar", "table"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></label>
                <label className={styles.field}>Aggregation<select value={panelDraft.aggregation} onChange={(event) => setPanelDraft({ ...panelDraft, aggregation: event.target.value as PanelDraft["aggregation"] })}>{["avg", "min", "max", "sum", "count", "p95"].map((value) => <option key={value}>{value}</option>)}</select></label>
              </div>
              <label className={styles.field}>Filter variable<select value={panelDraft.filter_variable} onChange={(event) => setPanelDraft({ ...panelDraft, filter_variable: event.target.value })}><option value="">No variable filter</option>{dashboard.variables.filter((variable) => variable.variable_type === (panelDraft.metric_source === "server_metrics" ? "server" : panelDraft.metric_source === "container_metrics" ? "container" : "mount_point")).map((variable) => <option key={variable.id} value={variable.name}>{variable.label}</option>)}</select></label>
              <div className={styles.formRow}>
                <label className={styles.field}>Metric source<select value={panelDraft.metric_source} onChange={(event) => { const source = event.target.value as MetricSource; setPanelDraft({ ...panelDraft, metric_source: source, metric_name: metricCatalog[source][0], filter_variable: "" }); }}>{Object.keys(metricCatalog).map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className={styles.field}>Metric<select value={panelDraft.metric_name} onChange={(event) => setPanelDraft({ ...panelDraft, metric_name: event.target.value })}>{metricCatalog[panelDraft.metric_source].map((value) => <option key={value}>{value}</option>)}</select></label>
              </div>
              <div className={styles.formRow}>
                <label className={styles.field}>Width (24 columns)<input type="number" min={1} max={24} value={panelDraft.width} onChange={(event) => setPanelDraft({ ...panelDraft, width: Number(event.target.value) })} /></label>
                <label className={styles.field}>Height<input type="number" min={1} max={20} value={panelDraft.height} onChange={(event) => setPanelDraft({ ...panelDraft, height: Number(event.target.value) })} /></label>
              </div>
              <label className={styles.field}>Unit<input maxLength={30} value={panelDraft.unit} onChange={(event) => setPanelDraft({ ...panelDraft, unit: event.target.value })} placeholder="%, bytes, cores…" /></label>
              <div className={styles.dialogActions}><button className={styles.secondary} type="button" onClick={() => setPanelDialog(false)}>Cancel</button><button className={styles.primary} disabled={saving || !panelDraft.title.trim()}><Save size={14} /> {saving ? "Saving…" : "Save panel"}</button></div>
            </form>
          </div>
        </div>
      )}

      {variableDialog && (
        <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setVariableDialog(false); }}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="variables-title">
            <div className={styles.dialogHeader}><div><h2 id="variables-title">Dashboard variables</h2><p>Create safe, predefined filters for metric panels.</p></div><button className={styles.iconButton} type="button" onClick={() => { setVariableDialog(false); setEditingVariable(null); setVariableDraft(emptyVariable); }} aria-label="Close"><X size={16} /></button></div>
            {dashboard.variables.length > 0 && <div className={styles.variableList}>{dashboard.variables.map((variable) => <div key={variable.id}><span><strong>{variable.label}</strong><small>{variable.name} · {variable.variable_type} · {variable.options.length} options</small></span><div className={styles.panelActions}><button className={styles.iconButton} type="button" aria-label={`Edit ${variable.label}`} onClick={() => editVariable(variable)}><Edit3 size={13} /></button><button className={styles.iconButton} type="button" aria-label={`Delete ${variable.label}`} onClick={() => void removeVariable(variable)}><Trash2 size={13} /></button></div></div>)}</div>}
            <form className={styles.form} onSubmit={createVariable}>
              <div className={styles.formRow}><label className={styles.field}>Name<input required disabled={Boolean(editingVariable)} pattern="[a-z][a-z0-9_]{0,59}" placeholder="server" value={variableDraft.name} onChange={(event) => setVariableDraft({ ...variableDraft, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></label><label className={styles.field}>Label<input required maxLength={120} placeholder="Server" value={variableDraft.label} onChange={(event) => setVariableDraft({ ...variableDraft, label: event.target.value })} /></label></div>
              <label className={styles.field}>Type<select value={variableDraft.variable_type} onChange={(event) => setVariableDraft({ ...variableDraft, variable_type: event.target.value as DashboardVariable["variable_type"] })}>{["custom", "server", "container", "mount_point"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className={styles.field}>Options (one per line: Label=value)<textarea required placeholder={"Production server=server-uuid\nQA server=server-uuid"} value={variableDraft.options} onChange={(event) => setVariableDraft({ ...variableDraft, options: event.target.value })} /></label>
              <label className={styles.field}>Default value (optional)<input maxLength={255} value={variableDraft.default_value} onChange={(event) => setVariableDraft({ ...variableDraft, default_value: event.target.value })} /></label>
              <div className={styles.dialogActions}>{editingVariable && <button className={styles.secondary} type="button" onClick={() => { setEditingVariable(null); setVariableDraft(emptyVariable); }}>Cancel edit</button>}<button className={styles.secondary} type="button" onClick={() => setVariableDialog(false)}>Close</button><button className={styles.primary} disabled={saving || !variableDraft.name || !variableDraft.label || !variableDraft.options.trim()}>{saving ? "Saving…" : editingVariable ? "Save variable" : "Add variable"}</button></div>
            </form>
          </div>
        </div>
      )}

      {settingsDialog && (
        <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSettingsDialog(false); }}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className={styles.dialogHeader}><div><h2 id="settings-title">Dashboard settings</h2><p>Update the persisted dashboard metadata and defaults.</p></div><button className={styles.iconButton} type="button" onClick={() => setSettingsDialog(false)} aria-label="Close"><X size={16} /></button></div>
            <form className={styles.form} onSubmit={saveSettings}>
              <label className={styles.field}>Name<input required maxLength={160} value={settingsDraft.title} onChange={(event) => setSettingsDraft({ ...settingsDraft, title: event.target.value })} /></label>
              <label className={styles.field}>Description<textarea maxLength={2000} value={settingsDraft.description} onChange={(event) => setSettingsDraft({ ...settingsDraft, description: event.target.value })} /></label>
              <div className={styles.formRow}>
                <label className={styles.field}>Default range<select value={settingsDraft.default_time_range} onChange={(event) => setSettingsDraft({ ...settingsDraft, default_time_range: event.target.value })}>{["15m", "1h", "6h", "24h", "7d", "30d"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className={styles.field}>Refresh<select value={settingsDraft.refresh_interval_seconds} onChange={(event) => setSettingsDraft({ ...settingsDraft, refresh_interval_seconds: Number(event.target.value) })}>{[[0, "Off"], [5, "5 seconds"], [10, "10 seconds"], [30, "30 seconds"], [60, "1 minute"], [300, "5 minutes"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              </div>
              <label className={styles.field}>Folder<select value={settingsDraft.folder_id} onChange={(event) => setSettingsDraft({ ...settingsDraft, folder_id: event.target.value })}><option value="">Unfiled</option>{folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.title}</option>)}</select></label>
              <div className={styles.dialogActions}><button className={styles.secondary} type="button" onClick={() => setSettingsDialog(false)}>Cancel</button><button className={styles.primary} disabled={saving || !settingsDraft.title.trim()}><Save size={14} /> {saving ? "Saving…" : "Save changes"}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function LayoutDashboardIcon() {
  return <LineChart size={30} />;
}
