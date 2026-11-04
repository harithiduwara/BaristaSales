import { defineConfig, devices } from '@playwright/test';

// E2E against the mock API (12.1). The app is built with `--mode e2e` so it calls the mock.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    {
      command: 'node ../../tools/mock-api/dist/server.mjs',
      port: 8787,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite preview --outDir dist-e2e --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
