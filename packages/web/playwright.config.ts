import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const baseURL = `http://localhost:${PORT}`

// E2E runs against an already-running stack (web + server + Postgres) seeded via
// `pnpm --filter @kinora/server db:seed`. The suite logs in as the demo user.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
