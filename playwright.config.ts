import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:14232',
    trace: 'on-first-retry',
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'PORT=14232 bun run demo:start',
      url: 'http://localhost:14232',
      reuseExistingServer: !process.env.CI,
      timeout: 20000,
    },
    {
      command: 'PORT=14233 bun run docs:start',
      url: 'http://localhost:14233',
      reuseExistingServer: !process.env.CI,
      timeout: 20000,
    },
  ],
});
