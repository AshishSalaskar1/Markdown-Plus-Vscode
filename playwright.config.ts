import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { browserName: 'chromium', headless: true },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173',
    timeout: 120_000,
  },
});
