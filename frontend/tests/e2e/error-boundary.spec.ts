import { expect, test } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const routeDirectory = path.join('app', 'app', '(dashboard)', '__playwright-error');
const routeFile = path.join(routeDirectory, 'page.tsx');

test.beforeAll(() => {
  rmSync(routeDirectory, { recursive: true, force: true });
  mkdirSync(routeDirectory, { recursive: true });
  writeFileSync(routeFile, `'use client';

let shouldThrow = true;

export default function ErrorTestPage() {
  if (shouldThrow) {
    shouldThrow = false;
    throw new Error('Playwright render failure');
  }

  return <h1>Error recovery succeeded</h1>;
}
`);
});

test.afterAll(() => {
  rmSync(routeDirectory, { recursive: true, force: true });
});

test('dashboard error boundary retries a failed render', async ({ page }) => {
  await page.goto('/app/__playwright-error');
  await expect(page.getByRole('alert')).toContainText('This page could not be loaded');

  const retry = page.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeVisible();
  await retry.click();

  await expect(page.getByRole('heading', { name: 'Error recovery succeeded' })).toBeVisible();
});
