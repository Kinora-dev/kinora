import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { purgeScope } from '../src/billing/retention'
import { db } from '../src/db'
import { project, run } from '../src/db/schemas/index'
import { createUser, resetDb } from './helpers'

const DAY = 24 * 60 * 60 * 1000

beforeEach(resetDb)

async function seedRun(userId: string, startedAt: Date): Promise<string> {
  const projectId = randomUUID()
  await db.insert(project).values({ id: projectId, userId, slug: `s-${projectId}`, name: 'p' })
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

    await purgeScope(new Date(now - 30 * DAY), { includeUsers: [a.id] })

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

    await purgeScope(new Date(now - 30 * DAY), { excludeUsers: [b.id] })

    expect(await exists(oldA)).toBeFalsy()
    expect(await exists(oldB)).toBeTruthy()
  })

  it('no-ops when includeUsers is empty', async () => {
    const a = await createUser('a@test.dev')
    const old = await seedRun(a.id, new Date(Date.now() - 100 * DAY))

    await purgeScope(new Date(), { includeUsers: [] })

    expect(await exists(old)).toBeTruthy()
  })
})
