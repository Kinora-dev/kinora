import type { NormTest } from '@kinora/core'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyRun } from '../src/alerts/notify'
import { db } from '../src/db'
import { project, run, slackIntegration, test as testRow } from '../src/db/schemas/index'
import { createUser, resetDb } from './helpers'

const DAY = 24 * 60 * 60 * 1000

beforeEach(resetDb)
afterEach(() => vi.unstubAllGlobals())

function stubFetchOk() {
  const mock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', mock)
  return mock
}

function normTest(testKey: string, status: NormTest['status']): NormTest {
  return {
    testKey,
    title: testKey,
    titlePath: ['f.ts', testKey],
    file: 'f.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    status,
    ok: status !== 'unexpected',
    duration: 0,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
  }
}

async function seedProject(userId: string): Promise<string> {
  const id = randomUUID()
  await db.insert(project).values({ id, userId, slug: `s-${id}`, name: 'web-app' })
  return id
}

async function seedPrevRun(projectId: string, tests: NormTest[], startedAt: Date): Promise<void> {
  const runId = randomUUID()
  await db.insert(run).values({
    id: runId,
    projectId,
    startedAt,
    duration: 0,
    counts: { total: tests.length, expected: tests.length, unexpected: 0, flaky: 0, skipped: 0 },
  })
  if (tests.length)
    await db.insert(testRow).values(tests.map(t => ({ id: randomUUID(), runId, projectId, ...t })))
}

function setChannel(projectId: string, policy: 'always' | 'on-failure' | 'on-regression', enabled = true) {
  return db.insert(slackIntegration).values({ projectId, webhookUrl: 'https://hooks.slack.com/services/x', policy, enabled })
}

const PASS = { total: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 }
const FAIL = { total: 1, expected: 0, unexpected: 1, flaky: 0, skipped: 0 }

describe('notifyRun', () => {
  it('fires on a newly failing test with on-regression policy', async () => {
    const user = await createUser()
    const projectId = await seedProject(user.id)
    await setChannel(projectId, 'on-regression')
    await seedPrevRun(projectId, [normTest('t1', 'expected')], new Date(Date.now() - DAY))

    const fetchMock = stubFetchOk()
    await notifyRun({ userId: user.id, projectId, runId: 'r2', startedAt: new Date(), counts: FAIL, tests: [normTest('t1', 'unexpected')] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.text).toContain('Newly failing')
    expect(body.text).toContain('t1')
  })

  it('does not fire when there is no regression (on-regression)', async () => {
    const user = await createUser()
    const projectId = await seedProject(user.id)
    await setChannel(projectId, 'on-regression')
    await seedPrevRun(projectId, [normTest('t1', 'expected')], new Date(Date.now() - DAY))

    const fetchMock = stubFetchOk()
    await notifyRun({ userId: user.id, projectId, runId: 'r2', startedAt: new Date(), counts: PASS, tests: [normTest('t1', 'expected')] })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fires every run with always policy', async () => {
    const user = await createUser()
    const projectId = await seedProject(user.id)
    await setChannel(projectId, 'always')

    const fetchMock = stubFetchOk()
    await notifyRun({ userId: user.id, projectId, runId: 'r1', startedAt: new Date(), counts: PASS, tests: [normTest('t1', 'expected')] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the channel is disabled', async () => {
    const user = await createUser()
    const projectId = await seedProject(user.id)
    await setChannel(projectId, 'always', false)

    const fetchMock = stubFetchOk()
    await notifyRun({ userId: user.id, projectId, runId: 'r1', startedAt: new Date(), counts: PASS, tests: [normTest('t1', 'expected')] })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
