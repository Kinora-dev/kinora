import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// retentionPolicy is env-derived at module load, so pin one and re-import the graph with it.
vi.mock('../src/lib/env', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/lib/env')>()),
  retentionPolicy: { runDays: 30, keepLastRuns: 2, artifactDays: 7 },
}))
vi.resetModules()

const { purgeExpiredRuns } = await import('../src/billing/retention')
const { db } = await import('../src/db')
const { artifact, project, run } = await import('../src/db/schemas/index')
const { storage } = await import('../src/lib/storage')
const { createUser, ownedOrgId, resetDb } = await import('./helpers')

const DAY = 24 * 60 * 60 * 1000

beforeEach(resetDb)

async function seedProject(userId: string): Promise<string> {
  const id = randomUUID()
  await db.insert(project).values({ id, organizationId: await ownedOrgId(userId), slug: `s-${id}`, name: 'p' })
  return id
}

async function seedRun(projectId: string, daysAgo: number): Promise<string> {
  const id = randomUUID()
  await db.insert(run).values({
    id,
    projectId,
    startedAt: new Date(Date.now() - daysAgo * DAY),
    duration: 0,
    counts: { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
  })
  return id
}

async function seedArtifact(projectId: string, runId: string): Promise<void> {
  const key = `${projectId}/${runId}/trace.zip`
  await storage.put(key, Buffer.from('zip'))
  await db.insert(artifact).values({ id: randomUUID(), projectId, runId, name: 'trace', contentType: 'application/zip', storageKey: key, size: 3 })
}

function runExists(id: string) {
  return db.query.run.findFirst({ where: eq(run.id, id), columns: { id: true } })
}

describe('purgeExpiredRuns on a configured self-host', () => {
  it('applies the age window, the per-project cap, and the artifact window together', async () => {
    const u = await createUser()

    // Age (30d) then count (2 newest) both bite here.
    const aged = await seedProject(u.id)
    const tooOld = await seedRun(aged, 100)
    const beyondCap = await seedRun(aged, 10)
    const kept = await seedRun(aged, 5)
    const newest = await seedRun(aged, 1)

    // Inside every run window, so only the artifact sweep (7d) touches this one.
    const fresh = await seedProject(u.id)
    const oldEnoughForBlobSweep = await seedRun(fresh, 20)
    const recent = await seedRun(fresh, 1)
    await seedArtifact(fresh, oldEnoughForBlobSweep)
    await seedArtifact(fresh, recent)

    expect(await purgeExpiredRuns(new Date())).toEqual({ deleted: 2, artifacts: 1 })

    expect(await runExists(tooOld)).toBeFalsy() // past 30 days
    expect(await runExists(beyondCap)).toBeFalsy() // 3rd newest of its project
    expect(await runExists(kept)).toBeTruthy()
    expect(await runExists(newest)).toBeTruthy()

    // The blob sweep never removes runs, only their artifacts.
    expect(await runExists(oldEnoughForBlobSweep)).toBeTruthy()
    expect(await db.query.artifact.findMany({ where: eq(artifact.runId, oldEnoughForBlobSweep) })).toHaveLength(0)
    expect(await db.query.artifact.findMany({ where: eq(artifact.runId, recent) })).toHaveLength(1)
  })

  it('is idempotent: a second sweep finds nothing left to do', async () => {
    const u = await createUser()
    const p = await seedProject(u.id)
    await seedRun(p, 100)
    await seedRun(p, 1)

    await purgeExpiredRuns(new Date())
    expect(await purgeExpiredRuns(new Date())).toEqual({ deleted: 0, artifacts: 0 })
  })
})
