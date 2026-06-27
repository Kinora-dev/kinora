import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db'
import { artifact, project } from '../src/db/schemas/index'
import { caller, createApiKey, createUser, ingest, resetDb } from './helpers'

beforeEach(resetDb)

async function seedProject(userId: string): Promise<void> {
  await ingest(await createApiKey(userId))
}

describe('project router', () => {
  it('rename updates the project name', async () => {
    const u = await createUser()
    await seedProject(u.id)

    await (await caller(u)).project.rename({ projectId: 'web-app', name: 'Renamed' })
    const p = await db.query.project.findFirst({ where: eq(project.slug, 'web-app') })
    expect(p?.name).toBe('Renamed')
  })

  it('updateDescription sets the description', async () => {
    const u = await createUser()
    await seedProject(u.id)

    await (await caller(u)).project.updateDescription({ projectId: 'web-app', description: 'a project' })
    const p = await db.query.project.findFirst({ where: eq(project.slug, 'web-app') })
    expect(p?.description).toBe('a project')
  })

  it('rejects rename of a project owned by another org', async () => {
    const a = await createUser('a@test.dev')
    await seedProject(a.id)
    const b = await createUser('b@test.dev')

    await expect((await caller(b)).project.rename({ projectId: 'web-app', name: 'x' })).rejects.toThrow(/not found/i)
  })

  it('delete removes the project and its artifact blobs', async () => {
    const u = await createUser()
    const key = await createApiKey(u.id)
    const { runId } = await (await ingest(key)).json() as { runId: string }
    const p = await db.query.project.findFirst({ where: eq(project.slug, 'web-app') })
    await db.insert(artifact).values({
      id: randomUUID(),
      projectId: p!.id,
      runId,
      name: 'trace',
      contentType: 'application/zip',
      storageKey: `${p!.id}/${runId}/trace.zip`,
      size: 1,
    })

    await (await caller(u)).project.delete({ projectId: 'web-app' })
    expect(await db.query.project.findFirst({ where: eq(project.slug, 'web-app') })).toBeUndefined()
    expect(await db.query.artifact.findMany()).toHaveLength(0)
  })
})
