import { expect, Page, test } from "@playwright/test";

const now = "2026-09-23T10:00:00Z";

const dashboard = {
  id: "dashboard-1",
  title: "Production health",
  slug: "production-health",
  description: "Core read-only signals",
  folder_id: null,
  default_time_range: "1h",
  refresh_interval_seconds: 30,
  panel_count: 0,
  panels: [],
  variables: [],
  created_at: now,
  updated_at: now,
};

const identity = {
  username: "operator",
  email: "operator@example.test",
  role: "owner",
  workspace: { role: "owner" },
};

async function mockWorkspaceApi(page: Page) {
  let dashboards = [{ ...dashboard }];
  let panels: Record<string, unknown>[] = [];
  let folders: Record<string, unknown>[] = [];
  let variables: Record<string, unknown>[] = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();

    if (path === "/auth/me") return route.fulfill({ json: identity });
    if (path === "/alerts/summary") return route.fulfill({ json: { active: 0 } });
    if (path === "/dashboards/folders" && method === "GET") return route.fulfill({ json: folders });
    if (path === "/dashboards/folders" && method === "POST") {
      const created = { id: "folder-1", slug: "production", ...request.postDataJSON(), created_at: now, updated_at: now };
      folders = [...folders, created];
      return route.fulfill({ status: 201, json: created });
    }
    if (path === "/dashboards/folders/folder-1" && method === "DELETE") {
      folders = [];
      return route.fulfill({ status: 204, body: "" });
    }

    if (path === "/dashboards" && method === "GET") {
      return route.fulfill({ json: dashboards.map(({ panels, ...item }) => {
        void panels;
        return item;
      }) });
    }
    if (path === "/dashboards" && method === "POST") {
      const payload = request.postDataJSON();
      const created = {
        ...dashboard,
        id: "dashboard-2",
        slug: "service-overview",
        ...payload,
      };
      dashboards = [created, ...dashboards];
      return route.fulfill({ status: 201, json: created });
    }
    if (path === "/dashboards/dashboard-1" && method === "GET") {
      return route.fulfill({ json: { ...dashboard, panel_count: panels.length, panels, variables } });
    }
    if (path === "/dashboards/dashboard-1" && method === "PATCH") {
      Object.assign(dashboard, request.postDataJSON());
      return route.fulfill({ json: { ...dashboard, panel_count: panels.length } });
    }
    if (path === "/dashboards/dashboard-1/panels" && method === "POST") {
      const created = {
        id: "panel-1",
        dashboard_id: dashboard.id,
        ...request.postDataJSON(),
        created_at: now,
        updated_at: now,
      };
      panels = [...panels, created];
      return route.fulfill({ status: 201, json: created });
    }
    if (path === "/dashboards/dashboard-1/panels/panel-1/data" && method === "GET") {
      return route.fulfill({ json: {
        panel_id: "panel-1",
        metric_source: "server_metrics",
        metric_name: "cpu_percent",
        aggregation: "avg",
        time_range: "1h",
        bucket_seconds: 15,
        series: [{ key: "all", label: "All targets", points: [{ time: now, value: 42.5 }] }],
        generated_at: now,
      } });
    }
    if (path === "/dashboards/dashboard-1/panels/panel-1" && method === "PATCH") {
      panels = panels.map((panel) => panel.id === "panel-1"
        ? { ...panel, ...request.postDataJSON(), updated_at: now }
        : panel);
      return route.fulfill({ json: panels[0] });
    }
    if (path === "/dashboards/dashboard-1/panels/panel-1" && method === "DELETE") {
      panels = [];
      return route.fulfill({ status: 204, body: "" });
    }
    if (path === "/dashboards/dashboard-1/variables" && method === "POST") {
      const created = { id: "variable-1", dashboard_id: dashboard.id, ...request.postDataJSON(), created_at: now, updated_at: now };
      variables = [...variables, created];
      return route.fulfill({ status: 201, json: created });
    }
    if (path === "/dashboards/dashboard-1/variables/variable-1" && method === "DELETE") {
      variables = [];
      return route.fulfill({ status: 204, body: "" });
    }

    return route.fulfill({ status: 404, json: { detail: `Unmocked ${method} ${path}` } });
  });
}

test.beforeEach(async ({ page }) => {
  await mockWorkspaceApi(page);
});

test("creates a persisted dashboard and opens it in the same tab", async ({ page }) => {
  await page.goto("/app/dashboards");
  await expect(page.getByRole("heading", { level: 1, name: "Build focused operational views." })).toBeVisible();

  await page.getByRole("button", { name: "New dashboard" }).click();
  await page.getByLabel("Name").fill("Service overview");
  await page.getByLabel("Description").fill("Read-only service signals");
  await page.getByRole("button", { name: "Create dashboard" }).click();

  const card = page.getByRole("link", { name: /Service overview/ });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", "/app/dashboards/dashboard-2");
  const originalPageCount = page.context().pages().length;
  await card.click();
  await expect(page).toHaveURL(/\/app\/dashboards\/dashboard-2$/);
  expect(page.context().pages()).toHaveLength(originalPageCount);
});

test("creates a folder and a persisted dashboard variable", async ({ page }) => {
  await page.goto("/app/dashboards");
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Production");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByRole("button", { name: "Production" })).toBeVisible();

  await page.goto("/app/dashboards/dashboard-1");
  await page.getByRole("button", { name: "Manage variables" }).click();
  await page.getByLabel("Name").fill("environment");
  await page.getByLabel("Label").fill("Environment");
  await page.getByLabel(/Options/).fill("Production=prod\nQA=qa");
  await page.getByRole("button", { name: "Add variable" }).click();
  await expect(page.getByText(/environment · custom · 2 options/)).toBeVisible();
});

test("adds, edits and deletes a real panel definition", async ({ page }) => {
  await page.goto("/app/dashboards/dashboard-1");
  await expect(page.getByRole("heading", { level: 1, name: "Production health" })).toBeVisible();

  await page.getByRole("button", { name: "Add panel" }).click();
  await page.getByLabel("Panel name").fill("CPU utilization");
  await page.getByRole("button", { name: "Save panel" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "CPU utilization" })).toBeVisible();
  await expect(page.getByLabel("CPU utilization metric chart")).toBeVisible();

  await page.getByRole("button", { name: "Edit CPU utilization" }).click();
  await page.getByLabel("Panel name").fill("CPU saturation");
  await page.getByLabel("Aggregation").selectOption("max");
  await page.getByRole("button", { name: "Save panel" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "CPU saturation" })).toBeVisible();
  await expect(page.getByLabel("CPU saturation metric chart")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete CPU saturation" }).click();
  await expect(page.getByText("No panels configured")).toBeVisible();
});
