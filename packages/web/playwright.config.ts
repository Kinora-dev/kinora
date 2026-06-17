import type { ReporterDescription } from '@playwright/test'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

const kinoraToken = process.env.KINORA_TOKEN
const gitMeta = process.env.GITHUB_SHA ? { sha: process.env.GITHUB_SHA, branch: process.env.GITHUB_REF_NAME } : undefined
const ciMeta = process.env.GITHUB_RUN_ID
  ? { provider: 'github', runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`, runNumber: process.env.GITHUB_RUN_NUMBER }
  : undefined
const baseReporter: ReporterDescription[] = ci ? [['github'], ['html', { open: 'never' }]] : [['list']]
const reporter: ReporterDescription[] = kinoraToken
  ? [['@kinora/reporter', { project: { slug: 'kinora-web-e2e', name: 'Kinora Web E2E' }, git: gitMeta, ci: ciMeta }], ...baseReporter]
  : baseReporter

// Same self-booted, disposable stack in dev and CI: dedicated ports + a kinora_e2e DB,
// so locally the dev stack (3000/5173, dev DB) keeps running untouched. `db:reset:e2e`
// (run by the test:e2e script, before playwright) prepares the DB.
const SERVER_PORT = 3399
const WEB_PORT = 5399
const serverUrl = `http://localhost:${SERVER_PORT}`
const baseURL = `http://localhost:${WEB_PORT}`

// Single source for the server URL; e2e helpers read it for direct tRPC probes.
process.env.E2E_SERVER_URL = serverUrl

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter,
  webServer: [
    {
      // Inline env so it reliably reaches the spawned process. dotenv (dev) / job env (CI) fills the rest.
      command: `PORT=${SERVER_PORT} BASE_URL=${serverUrl} WEB_ORIGIN=${baseURL} POSTGRES_DB=kinora_e2e KINORA_CLOUD=false pnpm --filter @kinora/server start`,
      url: `${serverUrl}/healthcheck`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `VITE_KINORA_SERVER_URL=${serverUrl} pnpm --filter @kinora/web exec vite --port ${WEB_PORT} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
