export type DashboardSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
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

export type DashboardDetail = DashboardSummary & { panels: DashboardPanel[] };

export type WorkspaceRole = "owner" | "admin" | "analyst" | "viewer";

export const canEditDashboards = (role?: string): boolean =>
  role === "owner" || role === "admin" || role === "analyst";
