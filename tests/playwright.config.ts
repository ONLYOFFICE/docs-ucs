import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',

  timeout: 0,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list', { printSteps: true }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],

  use: {
    headless: true,

    ignoreHTTPSErrors: true,

    actionTimeout: 0,
    navigationTimeout: 0,

    screenshot: 'only-on-failure',
    video: 'on',
    trace: 'retain-on-failure'
  },

  globalSetup: './global-setup.ts',

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium'
      }
    }
  ]
});
