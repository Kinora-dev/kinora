import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { currentPeriodResults } from '../src/billing/usage'
import { db } from '../src/db'
import { project, run, test as testRow } from '../src/db/schemas/index'
import { createUser, resetDb } from './helpers'

beforeEach(resetDb)

function lastInstantOfPreviousMonthUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1)
}

async function seedTests(userId: string, count: number, createdAt?: Date): Promise<void> {
  const projectId = randomUUID()
  await db.insert(project).values({ id: projectId, userId, slug: `slug-${projectId}`, name: 'p' })

  const runId = randomUUID()
  await db.insert(run).values({
    id: runId,
    projectId,
    startedAt: new Date(),
    duration: 0,
    counts: { total: count, expected: count, unexpected: 0, flaky: 0, skipped: 0 },
  })

  await db.insert(testRow).values(
    Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      runId,
      projectId,
      testKey: `key-${runId}-${i}`,
      title: 't',
      titlePath: ['file.ts', 't'],
      file: 'file.ts',
      line: 1,
      column: 1,
      projectName: 'chromium',
      status: 'expected',
      ok: true,
      duration: 0,
      retries: 0,
      tags: [],
      annotations: [],
      errors: [],
      attachments: [],
      ...(createdAt ? { createdAt } : {}),
    })),
  )
}

describe('currentPeriodResults', () => {
  it('counts this-month test rows for the user', async () => {
    const user = await createUser()
    await seedTests(user.id, 3)
    expect(await currentPeriodResults(user.id)).toBe(3)
  })

  it('excludes test rows from previous months', async () => {
    const user = await createUser()
    await seedTests(user.id, 3)
    await seedTests(user.id, 5, lastInstantOfPreviousMonthUtc())
    expect(await currentPeriodResults(user.id)).toBe(3)
  })

  it('scopes the count to the given user', async () => {
    const user = await createUser()
    const other = await createUser('other@test.dev')
    await seedTests(user.id, 2)
    await seedTests(other.id, 4)
    expect(await currentPeriodResults(user.id)).toBe(2)
  })
})
