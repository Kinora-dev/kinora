import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { ingestRunSchema } from '@kinora/core'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'
import { project, run, test } from '../db/schemas/index'
import { auth } from '../lib/auth'

const BEARER_PREFIX = 'Bearer '

// Public ingest API (api-key authed) - the reporter / cli upload here.
// Plain REST so any CI, curl, or language can hit it.
export const publicApi = new Hono<{ Variables: { userId: string } }>()

publicApi.use('*', async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith(BEARER_PREFIX))
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)

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
