import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '../src/db'
import { project, run } from '../src/db/schemas/index'
import { MAX_DASHBOARD_RUNS } from '../src/router/dashboard'
import { caller, createApiKey, createUser, ingest, runPayload } from './helpers'

describe('dashboard scoping', () => {
  it('manifest only returns the caller own projects', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    await ingest(await createApiKey(a.id))

    expect((await (await caller(a)).dashboard.manifest()).projects).toHaveLength(1)
    expect((await (await caller(b)).dashboard.manifest()).projects).toHaveLength(0)
  })

  it('rejects a run query on a project owned by another user', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    const { runId } = await (await ingest(await createApiKey(a.id))).json() as { runId: string }

    await expect((await caller(b)).dashboard.run({ projectId: 'web-app', runId })).rejects.toThrow()
  })

  it('rejects projectHistory on a project owned by another user', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    await ingest(await createApiKey(a.id))

    await expect((await caller(b)).dashboard.projectHistory({ projectId: 'web-app' })).rejects.toThrow()
  })

  it('manifest caps runs per project at DASHBOARD_MAX_RUNS', async () => {
    const a = await createUser('a@test.dev')
    await ingest(await createApiKey(a.id))
    const p = await db.query.project.findFirst({ where: eq(project.slug, 'web-app') })

    const extra = MAX_DASHBOARD_RUNS + 10
    await db.insert(run).values(Array.from({ length: extra }, () => ({
      id: randomUUID(),
      projectId: p!.id,
      startedAt: new Date(),
      duration: 0,
      counts: { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
    })))

    const m = await (await caller(a)).dashboard.manifest()
    expect(m.projects[0].runs).toHaveLength(MAX_DASHBOARD_RUNS)
  })

  it('manifest exposes countsByTag', async () => {
    const a = await createUser('a@test.dev')
    await ingest(await createApiKey(a.id))

    const m = await (await caller(a)).dashboard.manifest()
    expect(m.projects[0].runs[0].countsByTag['@smoke']?.total).toBe(1)
  })

  it('compareRuns diffs two runs by testKey', async () => {
    const a = await createUser('a@test.dev')
    const key = await createApiKey(a.id)
    const base = await (await ingest(key, runPayload('web-app', '@smoke', 'expected'))).json() as { runId: string }
    const head = await (await ingest(key, runPayload('web-app', '@smoke', 'unexpected'))).json() as { runId: string }

    const cmp = await (await caller(a)).dashboard.compareRuns({ projectId: 'web-app', baseRunId: base.runId, headRunId: head.runId })
    const broken = cmp.tests.find(t => t.change === 'broken')
    expect(broken?.baseStatus).toBe('expected')
    expect(broken?.headStatus).toBe('unexpected')
  })

  it('rejects compareRuns on a project owned by another user', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    const key = await createApiKey(a.id)
    const base = await (await ingest(key, runPayload('web-app'))).json() as { runId: string }
    const head = await (await ingest(key, runPayload('web-app'))).json() as { runId: string }

    await expect((await caller(b)).dashboard.compareRuns({ projectId: 'web-app', baseRunId: base.runId, headRunId: head.runId }))
      .rejects
      .toThrow()
  })
})
