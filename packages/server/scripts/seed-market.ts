import type { Counts, NormTest } from '@kinora/core'
import type { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { countsByTagFrom, makeTestKey } from '@kinora/core'
import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { apikey, artifact, member, project, run, test, user as userTable } from '../src/db/schemas/index'
import { auth } from '../src/lib/auth'
import { logger } from '../src/lib/logger'
import { storage } from '../src/lib/storage'

// Curated, DETERMINISTIC marketing data: same output every reseed so screenshots
// stay reproducible. Separate account from the dev demo seed (scripts/seed.ts).
const EMAIL = 'market@kinora.dev'
const PASSWORD = 'password123'
const NAME = 'Kinora'

const RUNS = 30
const DAY = 86_400_000
const LATEST = RUNS - 1

// Deterministic PRNG so durations/jitter/shas never move between reseeds.
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(0xC0FFEE)
const jitter = (n: number): number => Math.floor(rng() * n)

type Status = NormTest['status']
type Profile = 'solid' | 'mostlyGreen' | 'flakyHistory' | 'newlyFlaky' | 'newlyBroken' | 'newlyFailing' | 'fixed' | 'fixmeSkip'

// Status sequence per profile across run ordinals (0 = oldest, LATEST = newest).
// prior = ordinals 0..24, recent window = 25..29 (RECENT_WINDOW = 5 in core).
function statusAt(profile: Profile, i: number): Status {
  switch (profile) {
    case 'solid':
      return 'expected'
    case 'mostlyGreen':
      return i === 6 || i === 17 ? 'flaky' : 'expected'
    case 'flakyHistory':
      return i % 7 === 3 ? 'flaky' : 'expected'
    case 'newlyFlaky':
      return i === LATEST ? 'flaky' : 'expected'
    case 'newlyBroken':
      return i >= LATEST - 1 ? 'unexpected' : 'expected'
    // Compare(run-29 -> run-30) story: pass->fail (newly failing) and fail->pass (fixed).
    case 'newlyFailing':
      return i === LATEST ? 'unexpected' : 'expected'
    case 'fixed':
      return i === LATEST - 1 ? 'unexpected' : 'expected'
    case 'fixmeSkip':
      return 'skipped'
  }
}

interface TestDef {
  file: string
  title: string
  profile: Profile
  tags?: string[]
}

interface ProjectDef {
  slug: string
  name: string
  tests: TestDef[]
}

const PROJECTS: ProjectDef[] = [
  {
    // Healthy, but one test just started flaking -> FLAKY badge + newly-flaky signal.
    slug: 'web-app',
    name: 'Web App',
    tests: [
      { file: 'tests/auth.spec.ts', title: 'logs in with valid credentials', profile: 'solid', tags: ['@smoke', '@critical'] },
      { file: 'tests/auth.spec.ts', title: 'rejects a wrong password', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/checkout.spec.ts', title: 'adds an item to the cart', profile: 'mostlyGreen', tags: ['@smoke'] },
      { file: 'tests/checkout.spec.ts', title: 'completes a purchase', profile: 'flakyHistory', tags: ['@smoke', '@critical'] },
      { file: 'tests/checkout.spec.ts', title: 'applies a discount code', profile: 'solid' },
      { file: 'tests/search.spec.ts', title: 'returns relevant results', profile: 'newlyFlaky', tags: ['@critical'] },
      { file: 'tests/search.spec.ts', title: 'handles an empty query', profile: 'solid' },
      { file: 'tests/dashboard.spec.ts', title: 'renders widgets', profile: 'solid' },
    ],
  },
  {
    // A regression landed in the last runs -> FAILING badge, newly-broken + a real trace.
    slug: 'checkout-api',
    name: 'Checkout API',
    tests: [
      { file: 'tests/health.spec.ts', title: 'responds 200 on /healthz', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/payments.spec.ts', title: 'charges a card', profile: 'mostlyGreen', tags: ['@critical'] },
      { file: 'tests/payments.spec.ts', title: 'refunds an order', profile: 'newlyBroken', tags: ['@critical'] },
      { file: 'tests/webhooks.spec.ts', title: 'delivers order.paid', profile: 'newlyFlaky' },
      { file: 'tests/auth.spec.ts', title: 'rejects an expired token', profile: 'fixed', tags: ['@smoke'] },
      { file: 'tests/rate-limit.spec.ts', title: 'throttles past the quota', profile: 'newlyFailing' },
    ],
  },
  {
    // Stable -> PASSING badge, with an annotated skip to show annotations.
    slug: 'marketing-site',
    name: 'Marketing Site',
    tests: [
      { file: 'tests/home.spec.ts', title: 'renders the hero', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/home.spec.ts', title: 'newsletter signup works', profile: 'solid' },
      { file: 'tests/pricing.spec.ts', title: 'toggles annual billing', profile: 'mostlyGreen' },
      { file: 'tests/blog.spec.ts', title: 'lists recent posts', profile: 'fixmeSkip' },
      { file: 'tests/seo.spec.ts', title: 'has correct meta tags', profile: 'solid', tags: ['@smoke'] },
    ],
  },
]

function annotationsFor(profile: Profile, status: Status): NormTest['annotations'] {
  if (profile === 'fixmeSkip')
    return [{ type: 'fixme', description: 'flaky on CI - tracked in JIRA-412' }]
  if (status === 'skipped')
    return [{ type: 'skip', description: 'skipped on CI' }]
  return []
}

function errorsFor(def: TestDef, status: Status): NormTest['errors'] {
  if (status !== 'unexpected')
    return []
  return [{
    message: `Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 502`,
    stack: `at ${def.file}:34:18`,
  }]
}

function makeTest(def: TestDef, i: number, line: number): NormTest {
  const status = statusAt(def.profile, i)
  const titlePath = [def.file, def.title]
  return {
    testKey: makeTestKey(def.file, titlePath, 'chromium'),
    title: def.title,
    titlePath,
    file: def.file,
    line,
    column: 3,
    projectName: 'chromium',
    status,
    ok: status !== 'unexpected',
    duration: status === 'skipped' ? 0 : status === 'flaky' ? 800 + jitter(2500) : 200 + jitter(1800),
    retries: status === 'flaky' ? 1 : 0,
    tags: def.tags ?? [],
    annotations: annotationsFor(def.profile, status),
    errors: errorsFor(def, status),
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

// The signup hook auto-creates a personal org; resolve the one this user owns.
async function ownedOrgId(userId: string): Promise<string> {
  const m = await db.query.member.findFirst({ where: eq(member.userId, userId), columns: { organizationId: true } })
  if (!m)
    throw new Error('seeded user has no organization')
  return m.organizationId
}

// Failed -> real failing trace (carries error-context for the viewer's Copy prompt);
// flaky -> passing demo trace. Both make "View trace" work.
const FAIL_TRACE = fileURLToPath(new URL('../../trace-viewer/public/fixtures/error-trace.zip', import.meta.url))
const PASS_TRACE = fileURLToPath(new URL('../../trace-viewer/public/fixtures/demo.zip', import.meta.url))

async function main(): Promise<void> {
  const userId = await ensureUser()
  const orgId = await ownedOrgId(userId)
  const failTrace = await readFile(FAIL_TRACE)
  const passTrace = await readFile(PASS_TRACE)

  await db.delete(project).where(eq(project.organizationId, orgId))
  const apiKey = await auth.api.createApiKey({ body: { name: 'market seed token', userId } })
  await db.update(apikey).set({ referenceId: orgId }).where(eq(apikey.id, apiKey.id))

  for (const pdef of PROJECTS) {
    const projectId = randomUUID()
    await db.insert(project).values({ id: projectId, organizationId: orgId, slug: pdef.slug, name: pdef.name })

    for (let i = 0; i < RUNS; i++) {
      const startedAt = new Date(Date.now() - (LATEST - i) * DAY - jitter(6 * 3_600_000))
      const tests = pdef.tests.map((d, idx) => makeTest(d, i, 12 + idx * 9))
      // Readable run id: it's the run-page heading (the run table has no name column).
      const runId = `${pdef.slug}-run-${i + 1}`

      await db.insert(run).values({
        id: runId,
        projectId,
        startedAt,
        duration: tests.reduce((s, t) => s + t.duration, 0),
        counts: countsOf(tests),
        countsByTag: countsByTagFrom(tests),
        playwrightVersion: '1.60.0',
        git: { sha: Math.floor(rng() * 0xFFFFFFF).toString(16).padStart(7, '0'), branch: i % 4 === 1 ? 'develop' : 'main' },
        ci: { provider: 'github', runNumber: String(100 + i) },
      })

      const traced: { id: string, storageKey: string, buf: Buffer }[] = []
      const testRows = tests.map((t) => {
        const id = randomUUID()
        const hasTrace = t.status === 'unexpected' || t.status === 'flaky'
        if (hasTrace)
          traced.push({ id, storageKey: `${projectId}/${runId}/${randomUUID()}-trace.zip`, buf: t.status === 'unexpected' ? failTrace : passTrace })
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
        await storage.put(tr.storageKey, tr.buf)

      if (traced.length) {
        await db.insert(artifact).values(traced.map(tr => ({
          id: randomUUID(),
          projectId,
          runId,
          testId: tr.id,
          name: 'trace',
          contentType: 'application/zip',
          storageKey: tr.storageKey,
          size: tr.buf.length,
        })))
      }
    }
    logger.info(`seeded market project ${pdef.slug} (${RUNS} runs)`)
  }

  logger.info('-'.repeat(40))
  logger.info(`Login:     ${EMAIL} / ${PASSWORD}`)
  logger.info(`API token: ${apiKey.key}`)
  logger.info('-'.repeat(40))
  process.exit(0)
}

main().catch((err) => {
  logger.error(err)
  process.exit(1)
})
