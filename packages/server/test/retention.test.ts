import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { purgeArtifactsBefore, purgeBeyondLastRuns, purgeExpiredRuns, purgeScope } from '../src/billing/retention'
import { storageBytes } from '../src/billing/usage'
import { db } from '../src/db'
import { artifact, project, run } from '../src/db/schemas/index'
import { env } from '../src/lib/env'
import { storage } from '../src/lib/storage'
import { createUser, ownedOrgId, resetDb } from './helpers'

const DAY = 24 * 60 * 60 * 1000

beforeEach(resetDb)

async function seedProject(userId: string): Promise<string> {
  const projectId = randomUUID()
  await db.insert(project).values({ id: projectId, organizationId: await ownedOrgId(userId), slug: `s-${projectId}`, name: 'p' })
  return projectId
}

async function seedRunIn(projectId: string, startedAt: Date): Promise<string> {
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

async function seedRun(userId: string, startedAt: Date): Promise<string> {
  return seedRunIn(await seedProject(userId), startedAt)
}

async function seedArtifact(runId: string, name: string): Promise<string> {
  const { projectId } = (await db.query.run.findFirst({ where: eq(run.id, runId) }))!
  const key = `${projectId}/${runId}/${name}`
  await storage.put(key, Buffer.from('zip'))
  await db.insert(artifact).values({ id: randomUUID(), projectId, runId, name, contentType: 'application/zip', storageKey: key, size: 3 })
  return key
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
    const dest = resolve(env.STORAGE_DIR, await seedArtifact(runId, 'trace.zip'))
    expect(existsSync(dest)).toBe(true)

    const deleted = await purgeScope(new Date(), {})
    expect(deleted).toBe(1)
    expect(await exists(runId)).toBeFalsy()
    expect(existsSync(dest)).toBe(false) // blob removed
  })
})

describe('purgeBeyondLastRuns', () => {
  it('keeps the newest N runs of every project', async () => {
    const u = await createUser()
    const one = await seedProject(u.id)
    const two = await seedProject(u.id)
    const now = Date.now()
    const oldest = await seedRunIn(one, new Date(now - 3 * DAY))
    const middle = await seedRunIn(one, new Date(now - 2 * DAY))
    const newest = await seedRunIn(one, new Date(now - 1 * DAY))
    const other = await seedRunIn(two, new Date(now - 3 * DAY))

    expect(await purgeBeyondLastRuns(2)).toBe(1)

    expect(await exists(oldest)).toBeFalsy()
    expect(await exists(middle)).toBeTruthy()
    expect(await exists(newest)).toBeTruthy()
    expect(await exists(other)).toBeTruthy() // counted per project, not globally
  })

  it('no-ops when a project has fewer runs than the limit', async () => {
    const u = await createUser()
    const runId = await seedRun(u.id, new Date(Date.now() - 100 * DAY))

    expect(await purgeBeyondLastRuns(5)).toBe(0)
    expect(await exists(runId)).toBeTruthy()
  })

  it('keeps everything when the limit is 0', async () => {
    const u = await createUser()
    const projectId = await seedProject(u.id)
    await seedRunIn(projectId, new Date(Date.now() - 2 * DAY))
    const runId = await seedRunIn(projectId, new Date(Date.now() - 1 * DAY))

    expect(await purgeBeyondLastRuns(0)).toBe(0)
    expect(await exists(runId)).toBeTruthy()
  })
})

describe('purgeArtifactsBefore', () => {
  it('drops old blobs and rows but keeps the runs', async () => {
    const u = await createUser()
    const projectId = await seedProject(u.id)
    const old = await seedRunIn(projectId, new Date(Date.now() - 100 * DAY))
    const recent = await seedRunIn(projectId, new Date(Date.now() - 1 * DAY))
    const oldKey = resolve(env.STORAGE_DIR, await seedArtifact(old, 'trace.zip'))
    const recentKey = resolve(env.STORAGE_DIR, await seedArtifact(recent, 'trace.zip'))

    expect(await purgeArtifactsBefore(new Date(Date.now() - 30 * DAY))).toBe(1)

    expect(existsSync(oldKey)).toBe(false)
    expect(existsSync(recentKey)).toBe(true)
    expect(await db.query.artifact.findMany({ where: eq(artifact.runId, old) })).toHaveLength(0)
    expect(await exists(old)).toBeTruthy() // history survives the blob sweep
  })
})

describe('retention and the storage quota', () => {
  it('frees quota: purged artifacts stop counting against the org', async () => {
    const u = await createUser()
    const org = await ownedOrgId(u.id)
    const runId = await seedRun(u.id, new Date(Date.now() - 100 * DAY))
    await seedArtifact(runId, 'trace.zip')
    expect(await storageBytes(org)).toBe(3)

    await purgeScope(new Date(), {})
    expect(await storageBytes(org)).toBe(0)
  })
})

describe('purgeExpiredRuns', () => {
  it('is a no-op on self-host with no retention policy set', async () => {
    const a = await createUser()
    await seedRun(a.id, new Date(Date.now() - 1000 * DAY))
    expect(await purgeExpiredRuns(new Date())).toEqual({ deleted: 0, artifacts: 0 })
  })
})
