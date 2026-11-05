import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the production build, because the service
// worker only exists there (it is off in `pnpm dev`). Same /nail-tracker/ base as
// GitHub Pages, so paths and the worker scope match the live site.
const PORT = 4173

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/nail-tracker/`,
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/nail-tracker/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
