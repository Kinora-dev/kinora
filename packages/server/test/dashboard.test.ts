import { describe, expect, it } from 'vitest'
import { caller, createApiKey, createUser, ingest } from './helpers'

describe('dashboard scoping', () => {
  it('manifest only returns the caller own projects', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    await ingest(await createApiKey(a.id))

    expect((await caller(a).dashboard.manifest()).projects).toHaveLength(1)
    expect((await caller(b).dashboard.manifest()).projects).toHaveLength(0)
  })

  it('rejects a run query on a project owned by another user', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    const { runId } = await (await ingest(await createApiKey(a.id))).json() as { runId: string }

    await expect(caller(b).dashboard.run({ projectId: 'web-app', runId })).rejects.toThrow()
  })

  it('rejects projectHistory on a project owned by another user', async () => {
    const a = await createUser('a@test.dev')
    const b = await createUser('b@test.dev')
    await ingest(await createApiKey(a.id))

    await expect(caller(b).dashboard.projectHistory({ projectId: 'web-app' })).rejects.toThrow()
  })

  it('manifest exposes countsByTag', async () => {
    const a = await createUser('a@test.dev')
    await ingest(await createApiKey(a.id))

    const m = await caller(a).dashboard.manifest()
    expect(m.projects[0].runs[0].countsByTag['@smoke']?.total).toBe(1)
  })
})
