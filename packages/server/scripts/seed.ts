import type { Counts, NormTest } from '@kinora/core'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { makeTestKey } from '@kinora/core'
import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { artifact, project, run, test, user as userTable } from '../src/db/schemas/index'
import { auth } from '../src/lib/auth'
import { logger } from '../src/lib/logger'
import { storage } from '../src/lib/storage'

const EMAIL = 'demo@kinora.dev'
const PASSWORD = 'password123'
const NAME = 'Demo User'

const PROJECTS = [
  {
    slug: 'web-app',
    name: 'Web App',
    tests: [
      { file: 'tests/auth.spec.ts', title: 'logs in with valid credentials' },
      { file: 'tests/auth.spec.ts', title: 'rejects a wrong password' },
      { file: 'tests/checkout.spec.ts', title: 'adds an item to the cart' },
      { file: 'tests/checkout.spec.ts', title: 'completes a purchase' },
      { file: 'tests/checkout.spec.ts', title: 'applies a discount code' },
      { file: 'tests/search.spec.ts', title: 'returns relevant results' },
      { file: 'tests/search.spec.ts', title: 'handles an empty query' },
    ],
  },
  {
    slug: 'api-gateway',
    name: 'API Gateway',
    tests: [
      { file: 'tests/health.spec.ts', title: 'responds 200 on /healthz' },
      { file: 'tests/rate-limit.spec.ts', title: 'throttles past the quota' },
      { file: 'tests/auth.spec.ts', title: 'rejects an expired token' },
      { file: 'tests/proxy.spec.ts', title: 'forwards headers downstream' },
    ],
  },
  {
    slug: 'marketing-site',
    name: 'Marketing Site',
    tests: [
      { file: 'tests/home.spec.ts', title: 'renders the hero' },
      { file: 'tests/home.spec.ts', title: 'newsletter signup works' },
      { file: 'tests/pricing.spec.ts', title: 'toggles annual billing' },
    ],
  },
]

const DAY = 86_400_000
const RUNS_PER_PROJECT = 10

// Bias toward passing, with occasional flaky / failed / skipped for realism.
function pickStatus(): NormTest['status'] {
  const r = Math.random()
  if (r < 0.82)
    return 'expected'
  if (r < 0.90)
    return 'flaky'
  if (r < 0.97)
    return 'unexpected'
  return 'skipped'
}

function makeTest(def: { file: string, title: string }, status: NormTest['status']): NormTest {
  const titlePath = [def.file, def.title]
  const failed = status === 'unexpected'
  return {
    testKey: makeTestKey(def.file, titlePath, 'chromium'),
    title: def.title,
    titlePath,
    file: def.file,
    line: 10 + Math.floor(Math.random() * 40),
    column: 3,
    projectName: 'chromium',
    status,
    ok: status !== 'unexpected',
    duration: status === 'skipped' ? 0 : 200 + Math.floor(Math.random() * 4000),
    retries: status === 'flaky' ? 1 : 0,
    tags: def.file.includes('checkout') ? ['@smoke'] : [],
    annotations: status === 'skipped' ? [{ type: 'skip', description: 'flaky on CI' }] : [],
    errors: failed
      ? [{ message: `expect(received).toBe(expected)\n\nExpected: 200\nReceived: 500`, stack: `at ${def.file}:23:18` }]
      : [],
    attachments: [],
  }
}

function countsOf(tests: NormTest[]): Counts {
  const c: Counts = { total: tests.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0 }
  for (const t of tests)
    c[t.status]++
  return c
}

async function ensureUser(): Promise<string> {
  const existing = await db.query.user.findFirst({ where: eq(userTable.email, EMAIL), columns: { id: true } })
  if (existing)
    return existing.id
  const res = await auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: NAME } })
  return res.user.id
}

// A complete Playwright trace (screenshots + sources), reused for every seeded trace so "View trace" works in dev.
const TRACE_FIXTURE = fileURLToPath(new URL('../../trace-viewer/public/fixtures/demo.zip', import.meta.url))

async function main(): Promise<void> {
  const userId = await ensureUser()
  const traceBuf = await readFile(TRACE_FIXTURE)

  // Fresh data: cascade-deletes runs/tests/artifacts via FKs.
  await db.delete(project).where(eq(project.userId, userId))

  const apiKey = await auth.api.createApiKey({ body: { name: 'seed token', userId } })

  for (const pdef of PROJECTS) {
    const projectId = randomUUID()
    await db.insert(project).values({ id: projectId, userId, slug: pdef.slug, name: pdef.name })

    for (let i = RUNS_PER_PROJECT - 1; i >= 0; i--) {
      const startedAt = new Date(Date.now() - i * DAY - Math.floor(Math.random() * 6 * 3_600_000))
      const tests = pdef.tests.map(d => makeTest(d, pickStatus()))
      const runId = randomUUID()

      await db.insert(run).values({
        id: runId,
        projectId,
        startedAt,
        duration: tests.reduce((s, t) => s + t.duration, 0),
        counts: countsOf(tests),
        playwrightVersion: '1.60.0',
        git: { sha: randomUUID().slice(0, 7), branch: i === 0 ? 'main' : 'develop' },
        ci: { provider: 'github', runNumber: String(100 + i) },
      })

      // Attach a trace to the tests a user would actually inspect (failed / flaky).
      const traced: { id: string, storageKey: string }[] = []
      const testRows = tests.map((t) => {
        const id = randomUUID()
        const hasTrace = t.status === 'unexpected' || t.status === 'flaky'
        if (hasTrace)
          traced.push({ id, storageKey: `${projectId}/${runId}/${randomUUID()}-trace.zip` })
        return {
          id,
          runId,
          projectId,
          testKey: t.testKey,
          title: t.title,
          titlePath: t.titlePath,
          file: t.file,
          line: t.line,
          column: t.column,
          projectName: t.projectName,
          status: t.status,
          ok: t.ok,
          duration: t.duration,
          retries: t.retries,
          tags: t.tags,
          annotations: t.annotations,
          errors: t.errors,
          attachments: hasTrace
            ? [{ name: 'trace', contentType: 'application/zip', hasBody: true }]
            : t.attachments,
        }
      })
      await db.insert(test).values(testRows)

      for (const tr of traced)
        await storage.put(tr.storageKey, traceBuf)

      if (traced.length) {
        await db.insert(artifact).values(traced.map(tr => ({
          id: randomUUID(),
          projectId,
          runId,
          testId: tr.id,
          name: 'trace',
          contentType: 'application/zip',
          storageKey: tr.storageKey,
          size: traceBuf.length,
        })))
      }
    }
    logger.info(`seeded project ${pdef.slug} (${RUNS_PER_PROJECT} runs)`)
  }

  logger.info('—'.repeat(40))
  logger.info(`Login:     ${EMAIL} / ${PASSWORD}`)
  logger.info(`API token: ${apiKey.key}`)
  logger.info('—'.repeat(40))
  process.exit(0)
}

main().catch((err) => {
  logger.error(err)
  process.exit(1)
})
