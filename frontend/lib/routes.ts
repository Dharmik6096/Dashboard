const segment = (value: string | number) => encodeURIComponent(String(value));

export const routes = {
  platform: '/platform',
  platformInfrastructure: '/platform/infrastructure',
  platformDashboardBuilder: '/platform/dashboard-builder',
  platformReadOnlySecurity: '/platform/read-only-security',
  home: '/app',
  dashboards: '/app/dashboards',
  dashboard: (id: string | number) => `/app/dashboards/${segment(id)}`,
  servers: '/app/servers',
  addServer: '/app/servers/add',
  server: (id: string | number) => `/app/servers/${segment(id)}`,
  editServer: (id: string | number) => `/app/servers/${segment(id)}/edit`,
  serverTab: (id: string | number, tab: string) =>
    `/app/servers/${segment(id)}?${new URLSearchParams({ tab })}`,
  containers: '/app/containers',
  container: (id: string | number) => `/app/containers/${segment(id)}`,
  alerts: '/app/alerts',
  events: '/app/events',
} as const;
