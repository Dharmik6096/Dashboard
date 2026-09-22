import { test, expect } from './fixture';
import { type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { publicPages } from '../../lib/public-pages';

const desktopMenus = {
  Platform: [['Infrastructure','/platform/infrastructure'],['Containers','/platform#container-intelligence'],['Networks','/platform#map-dependencies'],['Data services','/platform#data-service-observability'],['Dashboards','/platform/dashboard-builder'],['Alerts & incidents','/platform#signal-not-noise'],['AI investigations','/platform#investigate-with-ai'],['Read-only security','/platform/read-only-security'],['Explore the platform','/platform']],
  Solutions: [['DevOps & SRE','/solutions#devops-sre'],['Platform engineering','/solutions#platform-engineering'],['Security teams','/solutions#security-teams'],['Engineering leaders','/solutions#engineering-leaders'],['Enterprise operations','/solutions#enterprise-operations'],['Managed services','/solutions#managed-service-providers'],['Docker estates','/integrations#docker'],['Kubernetes roadmap','/integrations#kubernetes'],['View solutions','/solutions']],
  Integrations: [['Linux','/integrations#linux'],['Docker','/integrations#docker'],['Nginx','/integrations#nginx'],['Cloud providers','/integrations#cloud-providers'],['PostgreSQL','/integrations#postgresql'],['Redis','/integrations#redis'],['RabbitMQ','/integrations#rabbitmq'],['Webhooks','/integrations#webhooks'],['Browse integrations','/integrations']],
  Resources: [['Documentation','/docs'],['Quickstart','/docs#quickstart'],['API reference','/docs#api'],['Security model','/security'],['About','/company'],['System status','/status'],['Contact engineering','/contact'],['Privacy & terms','/legal/privacy'],['Open quickstart','/docs#quickstart']],
} as const;
const mobileLinks = [['Platform','/platform'],['Solutions','/solutions'],['Integrations','/integrations'],['Pricing','/pricing'],['Docs','/docs'],['Security','/security'],['Company','/company'],['Status','/status'],['Sign in','/login'],['Start free','/signup']] as const;
const publicRoutes = Object.values(publicPages).map(page => page.path);

async function clickAndExpectSameTab(page: Page, link: Locator, expectedHref: string) {
  const count = page.context().pages().length;
  await expect(link).toHaveAttribute('href', expectedHref);
  await link.click();
  await expect.poll(() => page.context().pages().length).toBe(count);
  const expected = new URL(expectedHref, 'http://127.0.0.1:3105');
  await expect(page).toHaveURL((url: URL) => url.pathname === expected.pathname && url.hash === expected.hash);
}

test('every desktop Header menu link navigates in the same tab', async ({ page }) => {
  test.setTimeout(300_000);
  for (const [menuName, items] of Object.entries(desktopMenus)) for (const [label, href] of items) {
    await page.goto('/');
    const menu = page.locator('header').getByRole('button', { name: new RegExp(`^${menuName}`) });
    await menu.hover(); await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const link = page.locator('header').locator(`xpath=.//*[text()[1][normalize-space(.)="${label}"]]/ancestor::a[1]`).last();
    await clickAndExpectSameTab(page, link, href);
  }
  await page.goto('/'); await clickAndExpectSameTab(page, page.locator('header').getByRole('link', { name: 'Pricing', exact: true }), '/pricing');
});

test('every mobile Header link navigates in the same tab', async ({ page }) => {
  test.setTimeout(180_000); await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, href] of mobileLinks) { await page.goto('/'); await page.getByRole('button', { name: 'Toggle menu' }).click(); await clickAndExpectSameTab(page, page.locator('.mobile-nav').getByRole('link', { name: label, exact: true }), href); }
});

test('every Footer link has a same-tab destination and internal links navigate correctly', async ({ page }) => {
  test.setTimeout(180_000);
  await page.route('https://github.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>GitHub</h1>' }));
  await page.route('https://linkedin.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>LinkedIn</h1>' }));
  await page.goto('/'); const count = await page.locator('footer a').count();
  for (let index=0; index<count; index+=1) { await page.goto('/'); const link=page.locator('footer a').nth(index); const href=await link.getAttribute('href'); expect(href).toBeTruthy(); await expect(link).not.toHaveAttribute('target','_blank'); const expected=new URL(href!,'http://127.0.0.1:3105'); const pageCount=page.context().pages().length; await link.click(); await expect.poll(()=>page.context().pages().length).toBe(pageCount); await expect(page).toHaveURL((url: URL)=>url.origin===expected.origin&&url.pathname===expected.pathname&&url.hash===expected.hash); }
});

test('every primary CTA on every marketing page navigates in the same tab', async ({ page }) => {
  test.setTimeout(300_000);
  for (const route of publicRoutes) { await page.goto(route); const count=await page.locator('main a.btn-primary').count(); for(let index=0;index<count;index+=1){await page.goto(route);const link=page.locator('main a.btn-primary').nth(index);const href=await link.getAttribute('href');expect(href,`${route} primary CTA ${index+1} is missing href`).toBeTruthy();await clickAndExpectSameTab(page,link,href!);} }
});

test('public pages expose per-page metadata and exactly one h1', async ({ page }) => {
  test.setTimeout(240_000);
  for (const item of Object.values(publicPages)) { await page.goto(item.path); await expect(page).toHaveTitle(new RegExp(item.title)); await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',item.description); await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content',`${item.title} | DevOps Monitor V2`); await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content',item.description); await expect(page.locator('h1'),`${item.path} must contain exactly one h1`).toHaveCount(1); }
});

test('public pages have no automatically detectable axe violations', async ({ page }) => {
  test.setTimeout(300_000);
  for (const route of publicRoutes) { await page.goto(route); const results=await new AxeBuilder({page}).analyze(); expect(results.violations,`${route}: ${results.violations.map(item=>`${item.id} (${item.nodes.length})`).join(', ')}`).toEqual([]); }
});

test('Header menu has a visible keyboard focus indicator and opens from the keyboard', async ({ page }) => {
  await page.goto('/'); const platform=page.locator('header').getByRole('button',{name:/^Platform/}); await platform.focus(); await expect(platform).toBeFocused(); const style=await platform.evaluate(element=>{const s=getComputedStyle(element);return{width:s.outlineWidth,style:s.outlineStyle};}); expect(style.style).not.toBe('none'); expect(Number.parseFloat(style.width)).toBeGreaterThanOrEqual(2); await page.keyboard.press('Enter'); await expect(platform).toHaveAttribute('aria-expanded','true');
});

test('sitemap and robots expose public routes and protect dashboard crawling', async ({ request }) => {
  const sitemap=await request.get('/sitemap.xml');expect(sitemap.ok()).toBeTruthy();const xml=await sitemap.text();for(const page of Object.values(publicPages).filter(item=>!("index" in item)||item.index!==false))expect(xml).toContain(page.path==='/'?'http://localhost:3000/':`http://localhost:3000${page.path}`);const robots=await request.get('/robots.txt');expect(robots.ok()).toBeTruthy();expect(await robots.text()).toContain('Disallow: /app/');
});

// force cache invalidation
