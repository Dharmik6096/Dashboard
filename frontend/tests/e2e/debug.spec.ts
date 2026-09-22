import { test, expect } from '@playwright/test';
const { chromium } = require('playwright');
test('test integrations CTA', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/integrations');
  const link = page.locator('main a.btn-primary').first();
  const href = await link.getAttribute('href');
  console.log("HREF IS", href);
  
  await link.click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  console.log("URL AFTER CLICK IS", page.url());
  expect(page.url()).toContain(href);
});
