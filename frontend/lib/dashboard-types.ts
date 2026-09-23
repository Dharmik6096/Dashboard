export type DashboardSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  folder_id: string | null;
  default_time_range: string;
  refresh_interval_seconds: number;
  panel_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type GridPosition = { x: number; y: number; width: number; height: number };

export type DashboardPanel = {
  id: string;
  dashboard_id: string;
  title: string;
  description: string | null;
  visualization: "time_series" | "stat" | "gauge" | "bar" | "table";
  metric_source: "server_metrics" | "container_metrics" | "disk_metrics";
  metric_name: string;
  aggregation: "avg" | "min" | "max" | "sum" | "count" | "p95";
  unit: string | null;
  query_config: {
    server_id: string | null;
    container_id: string | null;
    mount_point: string | null;
    server_variable: string | null;
    container_variable: string | null;
    mount_point_variable: string | null;
    group_by: "none" | "server" | "container" | "mount_point";
  };
  grid_position: GridPosition;
  display_options: {
    color: string | null;
    decimals: number;
    show_legend: boolean;
    show_points: boolean;
  };
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type DashboardFolder = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DashboardVariable = {
  id: string;
  dashboard_id: string;
  name: string;
  label: string;
  variable_type: "custom" | "server" | "container" | "mount_point";
  options: { label: string; value: string }[];
  default_value: string | null;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type DashboardDetail = DashboardSummary & {
  panels: DashboardPanel[];
  variables: DashboardVariable[];
};

export type PanelDataPoint = { time: string; value: number | null };

export type PanelMetricData = {
  panel_id: string;
  metric_source: DashboardPanel["metric_source"];
  metric_name: string;
  aggregation: DashboardPanel["aggregation"];
  time_range: string;
  bucket_seconds: number;
  series: { key: string; label: string; points: PanelDataPoint[] }[];
  generated_at: string;
};

export type WorkspaceRole = "owner" | "admin" | "analyst" | "viewer";

export const canEditDashboards = (role?: string): boolean =>
  role === "owner" || role === "admin" || role === "analyst";
