import { test, expect } from './fixture';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { routes as dashboardRoutes } from '../../lib/routes';

const platformPages = [
  { label: 'Infrastructure', href: dashboardRoutes.platformInfrastructure, heading: 'Infrastructure context without production control risk.' },
  { label: 'Dashboards', href: dashboardRoutes.platformDashboardBuilder, heading: 'Operational views today. A configurable builder on the roadmap.' },
  { label: 'Read-only security', href: dashboardRoutes.platformReadOnlySecurity, heading: 'Observe infrastructure without turning monitoring into a control plane.' },
] as const;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name).replace(/\\/g, '/');
    return entry.isDirectory() ? files(file) : [file];
  });
}

const pages = files('app').filter(file => file.endsWith('/page.tsx'));
const routes = pages.map(file => '/' + file.split('/').slice(1, -1)
  .filter(part => !part.startsWith('(')).join('/'));
const matchesRoute = (url: string) => routes.some(route => new RegExp('^' +
  route.replace(/\[.*?\]/g, '[^/]+') + '/?$').test(url.split(/[?#]/)[0]));

test('navigation literals use real routes and canonical dashboard paths', () => {
  const failures: string[] = [];
  for (const file of [...files('app'), ...files('components')].filter(f => f.endsWith('.tsx'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const inspect = (node: ts.Node) => {
      let value: ts.Node | undefined;
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'href') value = node.initializer;
      if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'href') value = node.initializer;
      if (ts.isCallExpression(node) && /^(router\.(push|replace)|redirect|permanentRedirect)$/.test(node.expression.getText(source))) value = node.arguments[0];
      if (value && ts.isJsxExpression(value)) value = value.expression;
      let target: string | undefined;
      if (value && ts.isStringLiteralLike(value)) target = value.text;
      // Data-driven root links are covered by the rendered link crawl below.
      if (value && ts.isTemplateExpression(value) && value.head.text !== '/') target = value.head.text + value.templateSpans.map(span => 'example' + span.literal.text).join('');
      if (value && ts.isPropertyAccessExpression(value) && value.expression.getText(source) === 'routes') {
        const resolved = dashboardRoutes[value.name.text as keyof typeof dashboardRoutes];
        if (typeof resolved === 'string') target = resolved;
      }
      if (value && ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) && value.expression.expression.getText(source) === 'routes') {
        const resolved = dashboardRoutes[value.expression.name.text as keyof typeof dashboardRoutes];
        if (typeof resolved === 'function') target = (resolved as (...args: string[]) => string)('example', 'overview');
      }
      if (target?.startsWith('/') && !target.startsWith('//')) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        if (!matchesRoute(target)) failures.push(`${file}:${line} missing route ${target}`);
        if (file.startsWith('app/app/') && (target === '/' || /^\/(servers|containers|alerts|events)(\/|\?|$)/.test(target))) {
          failures.push(`${file}:${line} noncanonical dashboard target ${target}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

test('public links including opened Header menus and Footer anchors resolve', async ({ page }) => {
  test.setTimeout(300_000);
  const targets = new Set<string>();
  for (const route of routes.filter(route => !route.startsWith('/app') && !route.includes('['))) {
    await page.goto(route);
    const collect = async () => {
      for (const href of await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).href))) {
        const url = new URL(href);
        if (url.origin === 'http://127.0.0.1:3105') targets.add(url.pathname + url.search + url.hash);
      }
    };
    await collect();
    for (const label of ['Platform', 'Solutions', 'Integrations', 'Resources']) {
      const menu = page.locator('header').getByText(label, { exact: true }).first();
      if (await menu.isVisible()) {
        await menu.hover();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
        await collect();
      }
    }
  }
  const failures: string[] = [];
  for (const target of targets) {
    if (!matchesRoute(target)) { failures.push(`Missing route: ${target}`); continue; }
    const response = await page.goto(target);
    if (!response || response.status() >= 400) failures.push(`HTTP ${response?.status()}: ${target}`);
    const hash = new URL(target, 'http://127.0.0.1:3105').hash.slice(1);
    if (hash && !await page.evaluate(id => !!document.getElementById(decodeURIComponent(id)), hash)) {
      failures.push(`Missing anchor: ${target}`);
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

test('Platform menu links to dedicated pages with the shared content structure', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/platform');
  const menu = page.locator('header').getByText('Platform', { exact: true }).first();
  await menu.hover();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');

  for (const item of platformPages) {
    await expect(page.locator('header').getByRole('link', { name: new RegExp(`^${item.label}`) })).toHaveAttribute('href', item.href);
  }

  for (const item of platformPages) {
    await page.goto(item.href);
    await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
    for (const section of ['problem', 'product-view', 'workflows', 'security', 'next-step']) {
      await expect(page.locator(`[data-section="${section}"]`)).toBeVisible();
    }
  }
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const item of platformPages) {
    test(`platform page ${item.label} ${viewport.width}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(item.href);
      await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${item.href.split('/').pop()}-${viewport.width}.png`), fullPage: true });
    });
  }
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`dashboard breadcrumbs ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/servers/add');
    const home = page.getByRole('link', { name: 'Infrastructure', exact: true });
    await expect(home).toHaveAttribute('href', '/app');
    await page.screenshot({ path: testInfo.outputPath('breadcrumbs.png'), fullPage: true });
    await home.click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/app$/);
  });
}
