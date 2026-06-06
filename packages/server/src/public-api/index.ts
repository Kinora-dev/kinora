import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { ingestRunSchema } from '@kinora/core'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'
import { artifact, project, run, test } from '../db/schemas/index'
import { auth } from '../lib/auth'
import { storage } from '../lib/storage'

const BEARER_PREFIX = 'Bearer '

// Public ingest API (api-key authed) - the reporter / cli upload here.
// Plain REST so any CI, curl, or language can hit it.
export const publicApi = new Hono<{ Variables: { userId: string } }>()

publicApi.use('*', async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith(BEARER_PREFIX))
    return c.json({ error: 'Invalid API key' }, 401)

  const key = header.slice(BEARER_PREFIX.length).trim()
  const verification = await auth.api.verifyApiKey({ body: { key } })
  if (!verification.valid || !verification.key)
    return c.json({ error: 'Invalid API key' }, 401)

  c.set('userId', verification.key.referenceId)
  await next()
})

publicApi.post('/runs', zValidator('json', ingestRunSchema), async (c) => {
  const userId = c.get('userId')
  const input = c.req.valid('json')

  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.project.findFirst({
      where: and(eq(project.userId, userId), eq(project.slug, input.project.slug)),
      columns: { id: true },
    })

    let projectId = existing?.id
    if (!projectId) {
      projectId = randomUUID()
      await tx.insert(project).values({
        id: projectId,
        userId,
        slug: input.project.slug,
        name: input.project.name,
      })
    }

    const runId = randomUUID()
    await tx.insert(run).values({
      id: runId,
      projectId,
      startedAt: new Date(input.run.startedAt),
      duration: input.run.duration,
      counts: input.run.counts,
      playwrightVersion: input.run.playwrightVersion,
      git: input.run.git,
      ci: input.run.ci,
      shards: input.run.shards,
    })

    if (input.tests.length) {
      await tx.insert(test).values(input.tests.map(item => ({
        id: randomUUID(),
        runId,
        projectId,
        testKey: item.testKey,
        title: item.title,
        titlePath: item.titlePath,
        file: item.file,
        line: item.line,
        column: item.column,
        projectName: item.projectName,
        status: item.status,
        ok: item.ok,
        duration: item.duration,
        retries: item.retries,
        tags: item.tags,
        annotations: item.annotations,
        errors: item.errors,
        attachments: item.attachments,
      })))
    }

    return { projectId, runId, tests: input.tests.length }
  })

  return c.json(result, 201)
})

// Upload a trace.zip (or other binary artifact) for a run, linked to a test.
publicApi.post('/runs/:runId/artifacts', async (c) => {
  const userId = c.get('userId')
  const runId = c.req.param('runId')

  const r = await db.query.run.findFirst({
    where: eq(run.id, runId),
    columns: { id: true, projectId: true },
  })
  if (!r)
    return c.json({ error: 'Run not found' }, 404)

  const owner = await db.query.project.findFirst({
    where: and(eq(project.id, r.projectId), eq(project.userId, userId)),
    columns: { id: true },
  })
  if (!owner)
    return c.json({ error: 'Run not found' }, 404)

  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File))
    return c.json({ error: 'file is required' }, 400)
  const testKey = typeof body.testKey === 'string' ? body.testKey : ''
  const name = typeof body.name === 'string' ? body.name : 'trace'

  const buf = Buffer.from(await file.arrayBuffer())
  const key = `${r.projectId}/${runId}/${randomUUID()}-${name}.zip`
  await storage.put(key, buf)

  const t = testKey
    ? await db.query.test.findFirst({
        where: and(eq(test.runId, runId), eq(test.testKey, testKey)),
        columns: { id: true },
      })
    : undefined

  await db.insert(artifact).values({
    id: randomUUID(),
    projectId: r.projectId,
    runId,
    testId: t?.id,
    name,
    contentType: file.type || 'application/zip',
    storageKey: key,
    size: buf.length,
  })

  return c.json({ url: storage.url(key) }, 201)
})
