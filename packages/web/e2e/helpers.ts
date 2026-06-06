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
  tests: { attachments: { url?: string }[] }[]
}

// Hit the tRPC endpoints (with the logged-in session cookie) to locate a run that
// has a trace artifact, since which seeded tests get traces is randomised.
export async function findTracedRun(page: Page): Promise<{ slug: string, runId: string }> {
  const query = async <T>(path: string, input: unknown): Promise<T | undefined> => {
    const url = `${SERVER_URL}/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: input }))}`
    const res = await page.request.get(url)
    const json = await res.json() as [{ result?: { data?: T } }]
    return json[0]?.result?.data
  }

  const manifest = await query<Manifest>('dashboard.manifest', {})
  for (const project of manifest?.projects ?? []) {
    for (const run of project.runs) {
      const report = await query<RunReport>('dashboard.run', { projectId: project.id, runId: run.runId })
      const traced = report?.tests.some(t => t.attachments.some(a => a.url))
      if (traced)
        return { slug: project.id, runId: run.runId }
    }
  }
  throw new Error('no traced run found - reseed with `pnpm --filter @kinora/server db:seed`')
}
