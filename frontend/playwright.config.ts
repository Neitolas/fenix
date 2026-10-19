import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost:8443',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
    {
      name: 'compact-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
