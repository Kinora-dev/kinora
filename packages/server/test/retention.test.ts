import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { purgeExpiredRuns, purgeScope } from '../src/billing/retention'
import { db } from '../src/db'
import { artifact, project, run } from '../src/db/schemas/index'
import { env } from '../src/lib/env'
import { storage } from '../src/lib/storage'
import { createUser, ownedOrgId, resetDb } from './helpers'

const DAY = 24 * 60 * 60 * 1000

beforeEach(resetDb)

async function seedRun(userId: string, startedAt: Date): Promise<string> {
  const projectId = randomUUID()
  await db.insert(project).values({ id: projectId, organizationId: await ownedOrgId(userId), slug: `s-${projectId}`, name: 'p' })
  const runId = randomUUID()
  await db.insert(run).values({
    id: runId,
    projectId,
    startedAt,
    duration: 0,
    counts: { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
  })
  return runId
}

function exists(runId: string) {
  return db.query.run.findFirst({ where: eq(run.id, runId), columns: { id: true } })
}

describe('purgeScope', () => {
  it('deletes in-scope runs older than the cutoff, keeps newer and out-of-scope', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    const now = Date.now()
    const oldA = await seedRun(a.id, new Date(now - 100 * DAY))
    const recentA = await seedRun(a.id, new Date(now - 1 * DAY))
    const oldB = await seedRun(b.id, new Date(now - 100 * DAY))

    await purgeScope(new Date(now - 30 * DAY), { includeOrgs: [await ownedOrgId(a.id)] })

    expect(await exists(oldA)).toBeFalsy()
    expect(await exists(recentA)).toBeTruthy()
    expect(await exists(oldB)).toBeTruthy()
  })

  it('spares the excluded users', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    const now = Date.now()
    const oldA = await seedRun(a.id, new Date(now - 100 * DAY))
    const oldB = await seedRun(b.id, new Date(now - 100 * DAY))

    await purgeScope(new Date(now - 30 * DAY), { excludeOrgs: [await ownedOrgId(b.id)] })

    expect(await exists(oldA)).toBeFalsy()
    expect(await exists(oldB)).toBeTruthy()
  })

  it('no-ops when includeUsers is empty', async () => {
    const a = await createUser('a@test.dev')
    const old = await seedRun(a.id, new Date(Date.now() - 100 * DAY))

    await purgeScope(new Date(), { includeOrgs: [] })

    expect(await exists(old)).toBeTruthy()
  })

  it('deletes the artifact blobs of purged runs', async () => {
    const u = await createUser()
    const runId = await seedRun(u.id, new Date(Date.now() - 100 * DAY))
    const projectId = (await db.query.run.findFirst({ where: eq(run.id, runId) }))!.projectId
    const key = `${projectId}/${runId}/trace.zip`
    await storage.put(key, Buffer.from('zip'))
    await db.insert(artifact).values({ id: randomUUID(), projectId, runId, name: 'trace', contentType: 'application/zip', storageKey: key, size: 3 })
    const dest = resolve(env.STORAGE_DIR, key)
    expect(existsSync(dest)).toBe(true)

    const deleted = await purgeScope(new Date(), {})
    expect(deleted).toBe(1)
    expect(await exists(runId)).toBeFalsy()
    expect(existsSync(dest)).toBe(false) // blob removed
  })
})

describe('purgeExpiredRuns', () => {
  it('is a no-op on self-host (cloud off)', async () => {
    const a = await createUser()
    await seedRun(a.id, new Date(Date.now() - 1000 * DAY))
    expect(await purgeExpiredRuns(new Date())).toEqual({ deleted: 0 })
  })
})
