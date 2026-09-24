import { expect, Page, test } from "@playwright/test";

const now = "2026-09-23T10:00:00Z";

async function mockWorkspacePages(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();

    if (path === "/auth/me") return route.fulfill({ json: { username: "operator", email: "operator@example.test", role: "owner" } });
    if (path === "/alerts/summary") return route.fulfill({ json: { active: 0 } });
    if (path === "/organizations/members" && method === "GET") return route.fulfill({ json: [
      { id: "member-1", name: "Operator", email: "operator@example.test", role: "owner", status: "active", last_active: now },
      { id: "member-2", name: "Invited user", email: "viewer@example.test", role: "viewer", status: "invited", last_active: null },
    ] });
    if (path === "/settings/apikeys" && method === "GET") return route.fulfill({ json: [
      { id: "key-1", name: "Collector", prefix: "abc123...", created_at: now, last_used: null },
      { id: "key-2", name: "Reporting", prefix: "def456...", created_at: now, last_used: now },
    ] });
    if (path === "/servers" && method === "GET") return route.fulfill({ json: [{ id: "server-1" }, { id: "server-2" }] });
    if (path === "/settings/notifications" && method === "GET") return route.fulfill({ json: { preferences: { "Critical failures": { email: true, slack: false, sms: false } } } });
    if (path === "/settings/notifications" && method === "PUT") return route.fulfill({ json: { message: "saved" } });
    if (path === "/organizations/invitations" && method === "POST") return route.fulfill({ status: 201, json: { id: "member-3", ...request.postDataJSON(), status: "invited" } });
    if (path === "/billing/plans") return route.fulfill({ json: [
      { id: "starter", name: "Starter", price_monthly: 0, host_limit: 5, retention_days: 7, features: ["Core dashboards"] },
      { id: "scale", name: "Scale", price_monthly: 49, host_limit: 50, retention_days: 30, features: ["Team roles"] },
    ] });
    if (path === "/billing/summary") return route.fulfill({ json: { plan: "Scale", status: "active", host_count: 8, host_limit: 50, period_end: now } });
    if (path === "/organizations/audit-log") return route.fulfill({ json: [
      { id: "event-1", action: "workspace.member_invited", actor: "operator@example.test", resource_type: "organization_member", resource_id: "resource-1", ip_address: "127.0.0.1", created_at: now },
    ] });
    if (path === "/ai/chat" && method === "POST") return route.fulfill({ json: { reply: "SUMMARY\nCPU pressure needs more evidence.", model: "gemini-test" } });

    return route.fulfill({ status: 404, json: { detail: `Unmocked ${method} ${path}` } });
  });
}

test.beforeEach(async ({ page }) => { await mockWorkspacePages(page); });

test("team page uses live API-key and member counts without placeholder actions", async ({ page }) => {
  await page.goto("/app/team");
  await expect(page.getByRole("heading", { level: 1, name: "Team & access" })).toBeVisible();
  await expect(page.getByText("Your active API keys").locator("..").getByText("2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Member actions" })).toHaveCount(0);
  await expect(page.getByText("viewer@example.test")).toBeVisible();
});

test("billing page renders only API-backed subscription values", async ({ page }) => {
  await page.goto("/app/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Plans & billing" })).toBeVisible();
  await expect(page.getByText("Current plan").locator("..").getByText("Scale", { exact: true })).toBeVisible();
  await expect(page.getByText("8 / 50", { exact: true })).toBeVisible();
  await expect(page.getByText("Invoice history")).toContainText("Roadmap");
});

test("audit page distinguishes recorded events from an empty filter result", async ({ page }) => {
  await page.goto("/app/audit");
  await expect(page.getByText("workspace.member_invited", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Filter activity").fill("does-not-exist");
  await expect(page.getByText("No events match this filter")).toBeVisible();
});

test("settings page labels unimplemented security and credential controls honestly", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Security" }).click();
  await expect(page.getByText("Two-factor authentication").locator("..").getByText("Roadmap", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "API keys" }).click();
  await expect(page.getByText("API-key request authentication is not implemented yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate/ })).toHaveCount(0);
  await page.getByRole("button", { name: "System" }).click();
  await expect(page.getByText("us-east-1")).toHaveCount(0);
  await expect(page.getByText("High Availability (HA)")).toHaveCount(0);
});

test("AI page sends a real request and displays the configured provider response", async ({ page }) => {
  await page.goto("/app/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Ops AI" })).toBeVisible();
  await page.getByLabel("Message").fill("Investigate CPU pressure");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("CPU pressure needs more evidence.")).toBeVisible();
  await expect(page.getByText("gemini-test")).toBeVisible();
});

test("operational pages distinguish API failures from valid empty data", async ({ page }) => {
  await page.goto("/app/alerts");
  await expect(page.getByText("Alerts unavailable")).toBeVisible();
  await page.goto("/app/events");
  await expect(page.getByText("Events unavailable")).toBeVisible();
  await page.goto("/app/cpu-spikes");
  await expect(page.getByText("CPU spike history could not be loaded from the alerts API.")).toBeVisible();
  await page.goto("/app/containers");
  await expect(page.getByText("Container inventory could not be loaded from the API.")).toBeVisible();
  await page.goto("/app/logs");
  await expect(page.getByText("Container inventory could not be loaded for the selected server.")).toBeVisible();
});
