import { describe, expect, it } from 'vitest'
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
