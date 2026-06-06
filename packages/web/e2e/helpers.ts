import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const DEMO = { email: 'demo@kinora.dev', password: 'password123' }

const SERVER_URL = 'http://localhost:3000'

export async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(DEMO.email)
  await page.locator('input[type="password"]').fill(DEMO.password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL('/')
}

interface Manifest {
  projects: { id: string, runs: { runId: string }[] }[]
}
interface RunReport {
  tests: { attachments: { url?: string }[], annotations: { type: string }[] }[]
}

// Hit a tRPC query with the logged-in session cookie.
async function query<T>(page: Page, path: string, input: unknown): Promise<T | undefined> {
  const url = `${SERVER_URL}/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: input }))}`
  const res = await page.request.get(url)
  const json = await res.json() as [{ result?: { data?: T } }]
  return json[0]?.result?.data
}

// Find a run whose report has a test matching `pred` (which seeded tests get
// traces / annotations is randomised, so we probe rather than hardcode).
async function findRun(page: Page, pred: (test: RunReport['tests'][number]) => boolean): Promise<{ slug: string, runId: string }> {
  const manifest = await query<Manifest>(page, 'dashboard.manifest', {})
  for (const project of manifest?.projects ?? []) {
    for (const run of project.runs) {
      const report = await query<RunReport>(page, 'dashboard.run', { projectId: project.id, runId: run.runId })
      if (report?.tests.some(pred))
        return { slug: project.id, runId: run.runId }
    }
  }
  throw new Error('no matching run found - reseed with `pnpm --filter @kinora/server db:seed`')
}

export function findTracedRun(page: Page): Promise<{ slug: string, runId: string }> {
  return findRun(page, t => t.attachments.some(a => a.url))
}

export function findAnnotatedRun(page: Page): Promise<{ slug: string, runId: string }> {
  return findRun(page, t => t.annotations.length > 0)
}
