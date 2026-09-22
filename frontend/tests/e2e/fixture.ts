import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith('http://localhost:8080') || url.includes('/api/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      } else {
        await route.fallback();
      }
    });
    await use(page);
  }
});

export { expect };
