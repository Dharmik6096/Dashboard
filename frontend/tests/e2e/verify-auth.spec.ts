import { test, expect } from '@playwright/test';

test.describe('Incognito auth verification', () => {
  const publicRoutes = ['/', '/pricing', '/docs', '/platform'];

  for (const route of publicRoutes) {
    test(`public route ${route} should load without redirecting`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(1000); 
      // Verify it stays on the public route
      const currentUrl = new URL(page.url());
      expect(currentUrl.pathname).toBe(route === '/' ? '/' : route);
      await page.screenshot({ path: `test-results/public-auth-${route.replace('/', '') || 'home'}.png` });
    });
  }

  test('app page should redirect to login without session', async ({ page }) => {
    await page.goto('/app');
    // Verify it redirects to login
    await expect(page).toHaveURL(/.*\/login/);
    await page.screenshot({ path: `test-results/app-redirect-login.png` });
  });
});
