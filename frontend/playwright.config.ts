import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3105',
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
    trace: 'retain-on-failure',
  },
  webServer: process.env.STATIC_LINK_CHECK === '1' ? undefined : {
    command: 'npm run dev -- --webpack --hostname 127.0.0.1 --port 3105',
    url: 'http://127.0.0.1:3105/servers',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
