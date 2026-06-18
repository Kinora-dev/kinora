import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { countsByTagFrom, ingestRunSchema } from '@kinora/core'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { notifyRun } from '../alerts/notify'
import { getEntitlements, ingestCapError, quotaCrossing, quotaWarningText } from '../billing/entitlements'
import { polarClient } from '../billing/polar'
import { currentPeriodResults, projectCount } from '../billing/usage'
import { db } from '../db'
import { artifact, member, project, run, test, user } from '../db/schemas/index'
import { auth } from '../lib/auth'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { sendMail } from '../lib/mailer'
import { storage } from '../lib/storage'

const BEARER_PREFIX = 'Bearer '

// Public ingest API (api-key authed) - the reporter / cli upload here. The token's
// referenceId is the owning organization id.
export const publicApi = new Hono<{ Variables: { orgId: string } }>()

publicApi.use('*', async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith(BEARER_PREFIX))
    return c.json({ error: 'Invalid API key' }, 401)

  const key = header.slice(BEARER_PREFIX.length).trim()
  const verification = await auth.api.verifyApiKey({ body: { key } })
  if (!verification.valid || !verification.key)
    return c.json({ error: 'Invalid API key' }, 401)

  c.set('orgId', verification.key.referenceId)
  await next()
})

publicApi.post('/runs', zValidator('json', ingestRunSchema), async (c) => {
  const orgId = c.get('orgId')
  const input = c.req.valid('json')
  // Bulk/historical import: still capped + metered, but no alerts (anti-spam).
  const backfill = c.req.query('backfill') === '1'

  const entitlements = await getEntitlements(orgId)
  const existing = await db.query.project.findFirst({
    where: and(eq(project.organizationId, orgId), eq(project.slug, input.project.slug)),
    columns: { id: true },
  })
  const isNewProject = !existing

  // Result cap is read only for free (the only metered tier); project count only when capped + new.
  const usedResults = entitlements.tier === 'free' ? await currentPeriodResults(orgId) : 0
  const projects = isNewProject && Number.isFinite(entitlements.maxProjects) ? await projectCount(orgId) : 0
  const cap = ingestCapError(entitlements, usedResults, isNewProject, projects)
  if (cap)
    return c.json(cap, 402)

  const result = await db.transaction(async (tx) => {
    let projectId = existing?.id
    if (!projectId) {
      projectId = randomUUID()
      await tx.insert(project).values({
        id: projectId,
        organizationId: orgId,
        slug: input.project.slug,
        name: input.project.name,
      })
    }

    const runId = randomUUID()
    await tx.insert(run).values({
      id: runId,
      projectId,
      startedAt: new Date(input.run.startedAt),
      // Playwright reports fractional ms; the column is integer.
      duration: Math.round(input.run.duration),
      counts: input.run.counts,
      countsByTag: countsByTagFrom(input.tests),
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
        duration: Math.round(item.duration),
        retries: item.retries,
        tags: item.tags,
        annotations: item.annotations,
        errors: item.errors,
        attachments: item.attachments,
      })))
    }

    return { projectId, runId, tests: input.tests.length }
  })

  if (polarClient && result.tests > 0) {
    try {
      // Polar customer = the org owner; meter usage against them.
      const owner = await db.query.member.findFirst({
        where: and(eq(member.organizationId, orgId), eq(member.role, 'owner')),
        columns: { userId: true },
      })
      if (owner) {
        await polarClient.events.ingest({
          events: [{
            name: 'test_results',
            externalCustomerId: owner.userId,
            metadata: { results: result.tests },
          }],
        })
      }
    }
    catch (error) {
      logger.error({ error, orgId, runId: result.runId }, 'polar usage ingest failed')
    }
  }

  if (!backfill) {
    try {
      await notifyRun({
        organizationId: orgId,
        projectId: result.projectId,
        runId: result.runId,
        startedAt: new Date(input.run.startedAt),
        branch: input.run.git?.branch,
        counts: input.run.counts,
        tests: input.tests,
      })
    }
    catch (error) {
      logger.error({ error, runId: result.runId }, 'alert notify failed')
    }
  }

  // Free-tier usage warning, fired on the ingest that crosses 80% / 100% of the monthly cap.
  if (!backfill && entitlements.tier === 'free' && result.tests > 0) {
    const kind = quotaCrossing(usedResults, usedResults + result.tests, entitlements.includedResults)
    if (kind) {
      try {
        const owner = await db.query.member.findFirst({
          where: and(eq(member.organizationId, orgId), eq(member.role, 'owner')),
          columns: { userId: true },
        })
        const u = owner
          ? await db.query.user.findFirst({ where: eq(user.id, owner.userId), columns: { email: true, name: true } })
          : null
        if (u) {
          sendMail({
            to: u.email,
            subject: kind === 'reached' ? 'You\'ve hit your kinora free limit' : 'You\'re nearing your kinora free limit',
            text: quotaWarningText(u.name, kind, usedResults + result.tests, entitlements.includedResults, env.WEB_ORIGIN),
          })
        }
      }
      catch (error) {
        logger.error({ error, orgId }, 'quota warning email failed')
      }
    }
  }

  return c.json(result, 201)
})

// Upload a trace.zip (or other binary artifact) for a run, linked to a test.
publicApi.post('/runs/:runId/artifacts', async (c) => {
  const orgId = c.get('orgId')
  const runId = c.req.param('runId')

  const r = await db.query.run.findFirst({
    where: eq(run.id, runId),
    columns: { id: true, projectId: true },
  })
  if (!r)
    return c.json({ error: 'Run not found' }, 404)

  const owner = await db.query.project.findFirst({
    where: and(eq(project.id, r.projectId), eq(project.organizationId, orgId)),
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
  // name is client-controlled; sanitize before it enters the storage path so it can't traverse.
  const safeName = name.replace(/[^\w.-]/g, '_').slice(0, 100) || 'trace'
  const key = `${r.projectId}/${runId}/${randomUUID()}-${safeName}.zip`
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

  return c.json({ url: await storage.url(key) }, 201)
})
