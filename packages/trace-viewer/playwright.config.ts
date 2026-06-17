import type { ReporterDescription } from '@playwright/test'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI
const PORT = 5174
const baseURL = `http://localhost:${PORT}`

const kinoraToken = process.env.KINORA_TOKEN
const gitMeta = process.env.GITHUB_SHA ? { sha: process.env.GITHUB_SHA, branch: process.env.GITHUB_REF_NAME } : undefined
const ciMeta = process.env.GITHUB_RUN_ID
  ? { provider: 'github', runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`, runNumber: process.env.GITHUB_RUN_NUMBER }
  : undefined
const baseReporter: ReporterDescription[] = ci ? [['github'], ['html', { open: 'never' }]] : [['list']]
const reporter: ReporterDescription[] = kinoraToken
  ? [['@kinora/reporter', { project: { slug: 'kinora-viewer-e2e', name: 'Kinora Trace Viewer E2E' }, git: gitMeta, ci: ciMeta }], ...baseReporter]
  : baseReporter

// E2E runs against the dev server, which loads the bundled demo trace by default.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
