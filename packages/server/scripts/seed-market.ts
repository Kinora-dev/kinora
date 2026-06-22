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
type Profile =
  | 'solid' | 'mostlyGreen' | 'flakyHistory' | 'chronicFlaky' | 'flakyCluster'
  | 'degrading' | 'outage' | 'recovering' | 'intermittent' | 'chronicFail'
  | 'newlyFlaky' | 'newlyBroken' | 'newlyFailing' | 'fixed' | 'fixmeSkip'

// Status sequence per profile across run ordinals (0 = oldest, LATEST = newest).
// Events are spread across the timeline (not just the tail) so per-run pass rates
// vary -> moving trend lines + multi-colored sparklines. recent window = 25..29.
function statusAt(profile: Profile, i: number): Status {
  switch (profile) {
    case 'solid':
      return 'expected'
    case 'mostlyGreen':
      return i === 6 || i === 17 ? 'flaky' : 'expected'
    case 'flakyHistory':
      return i % 7 === 3 ? 'flaky' : 'expected'
    case 'chronicFlaky': // regular amber dots throughout
      return i % 5 === 3 ? 'flaky' : 'expected'
    case 'flakyCluster': // bursts of flakiness
      return [7, 8, 9, 20, 21].includes(i) ? 'flaky' : 'expected'
    case 'degrading': // healthy, then unravels in the recent window
      return i < 22 ? 'expected' : i % 2 === 0 ? 'unexpected' : 'flaky'
    case 'outage': // a multi-run outage mid-history, then recovers
      return i >= 11 && i <= 13 ? 'unexpected' : i === 14 ? 'flaky' : 'expected'
    case 'recovering': // rough early, green ever since (upward trend)
      return i < 7 ? (i % 2 === 0 ? 'unexpected' : 'flaky') : 'expected'
    case 'intermittent': // scattered red + amber
      return [4, 15, 26].includes(i) ? 'unexpected' : [9, 21].includes(i) ? 'flaky' : 'expected'
    case 'chronicFail': // recurring failures + flakes
      return i % 7 === 5 ? 'unexpected' : i % 7 === 2 ? 'flaky' : 'expected'
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
    // Healthy with real flakiness + one test that just started flaking -> FLAKY badge.
    slug: 'web-app',
    name: 'Web App',
    tests: [
      { file: 'tests/auth.spec.ts', title: 'logs in with valid credentials', profile: 'solid', tags: ['@smoke', '@critical'] },
      { file: 'tests/auth.spec.ts', title: 'rejects a wrong password', profile: 'mostlyGreen', tags: ['@smoke'] },
      { file: 'tests/checkout.spec.ts', title: 'adds an item to the cart', profile: 'chronicFlaky', tags: ['@smoke'] },
      { file: 'tests/checkout.spec.ts', title: 'completes a purchase', profile: 'flakyCluster', tags: ['@smoke', '@critical'] },
      { file: 'tests/checkout.spec.ts', title: 'applies a discount code', profile: 'recovering' },
      { file: 'tests/search.spec.ts', title: 'returns relevant results', profile: 'newlyFlaky', tags: ['@critical'] },
      { file: 'tests/search.spec.ts', title: 'handles an empty query', profile: 'solid' },
      { file: 'tests/dashboard.spec.ts', title: 'renders widgets', profile: 'flakyHistory' },
    ],
  },
  {
    // A regression + a past outage -> FAILING badge, diverse errors, real traces.
    slug: 'checkout-api',
    name: 'Checkout API',
    tests: [
      { file: 'tests/health.spec.ts', title: 'responds 200 on /healthz', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/payments.spec.ts', title: 'charges a card', profile: 'mostlyGreen', tags: ['@critical'] },
      { file: 'tests/payments.spec.ts', title: 'refunds an order', profile: 'newlyBroken', tags: ['@critical'] },
      { file: 'tests/payments.spec.ts', title: 'splits a payment', profile: 'outage', tags: ['@critical'] },
      { file: 'tests/webhooks.spec.ts', title: 'delivers order.paid', profile: 'intermittent' },
      { file: 'tests/auth.spec.ts', title: 'rejects an expired token', profile: 'fixed', tags: ['@smoke'] },
      { file: 'tests/rate-limit.spec.ts', title: 'throttles past the quota', profile: 'newlyFailing' },
    ],
  },
  {
    // Stable -> PASSING badge, light flakiness + an annotated skip (shows annotations).
    slug: 'marketing-site',
    name: 'Marketing Site',
    tests: [
      { file: 'tests/home.spec.ts', title: 'renders the hero', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/home.spec.ts', title: 'newsletter signup works', profile: 'mostlyGreen' },
      { file: 'tests/pricing.spec.ts', title: 'toggles annual billing', profile: 'chronicFlaky' },
      { file: 'tests/blog.spec.ts', title: 'lists recent posts', profile: 'fixmeSkip' },
      { file: 'tests/seo.spec.ts', title: 'has correct meta tags', profile: 'recovering', tags: ['@smoke'] },
      { file: 'tests/contact.spec.ts', title: 'submits the form', profile: 'solid' },
    ],
  },
  {
    // Flaky-prone suite -> FLAKY badge, lots of amber across the history.
    slug: 'mobile-app',
    name: 'Mobile App',
    tests: [
      { file: 'tests/onboarding.spec.ts', title: 'completes the welcome flow', profile: 'flakyCluster', tags: ['@smoke'] },
      { file: 'tests/onboarding.spec.ts', title: 'requests notification permission', profile: 'chronicFlaky' },
      { file: 'tests/feed.spec.ts', title: 'pulls to refresh', profile: 'mostlyGreen', tags: ['@critical'] },
      { file: 'tests/feed.spec.ts', title: 'loads the next page', profile: 'intermittent' },
      { file: 'tests/profile.spec.ts', title: 'uploads an avatar', profile: 'newlyFlaky' },
      { file: 'tests/profile.spec.ts', title: 'edits the bio', profile: 'solid' },
      { file: 'tests/push.spec.ts', title: 'opens a deep link', profile: 'recovering' },
      { file: 'tests/offline.spec.ts', title: 'queues writes offline', profile: 'flakyHistory', tags: ['@critical'] },
    ],
  },
  {
    // Recurring failures + a recent regression -> FAILING badge, the reddest history.
    slug: 'api-gateway',
    name: 'API Gateway',
    tests: [
      { file: 'tests/routing.spec.ts', title: 'routes to the right service', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/auth.spec.ts', title: 'validates the JWT', profile: 'mostlyGreen', tags: ['@critical'] },
      { file: 'tests/ratelimit.spec.ts', title: 'returns 429 over quota', profile: 'chronicFail', tags: ['@critical'] },
      { file: 'tests/proxy.spec.ts', title: 'streams a large response', profile: 'degrading' },
      { file: 'tests/proxy.spec.ts', title: 'retries on upstream 503', profile: 'newlyBroken', tags: ['@critical'] },
      { file: 'tests/cors.spec.ts', title: 'allows preflight requests', profile: 'recovering' },
      { file: 'tests/metrics.spec.ts', title: 'exposes /metrics', profile: 'solid' },
    ],
  },
  {
    // Stable internal tool -> PASSING badge, occasional flakiness.
    slug: 'admin-dashboard',
    name: 'Admin Dashboard',
    tests: [
      { file: 'tests/users.spec.ts', title: 'lists and filters users', profile: 'solid', tags: ['@smoke'] },
      { file: 'tests/users.spec.ts', title: 'invites a teammate', profile: 'mostlyGreen' },
      { file: 'tests/billing.spec.ts', title: 'shows the current plan', profile: 'solid', tags: ['@critical'] },
      { file: 'tests/billing.spec.ts', title: 'exports an invoice', profile: 'chronicFlaky' },
      { file: 'tests/audit.spec.ts', title: 'records an audit log', profile: 'flakyHistory' },
      { file: 'tests/reports.spec.ts', title: 'generates a CSV', profile: 'fixmeSkip' },
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

// A spread of realistic Playwright failures so the run/test/trace views aren't all
// the same assertion. Picked deterministically per test title (stable across reseeds).
const ERROR_POOL = [
  `Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 502`,
  `TimeoutError: locator.click: Timeout 15000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Pay now' })\n  - locator resolved to <button disabled>Pay now</button>`,
  `Error: expect(locator).toBeVisible() failed\n\nLocator: getByText('Order confirmed')\nExpected: visible\nReceived: <element(s) not found>`,
  `Error: expect(response).toBeOK() failed\n\n  → GET /api/orders/42\n  ← 500 Internal Server Error`,
  `Error: expect(received).toHaveText(expected)\n\nExpected: "Welcome back"\nReceived: "Session expired"`,
  `Error: page.goto: net::ERR_CONNECTION_REFUSED\nNavigating to "http://localhost:3000/checkout"`,
]

function errorsFor(def: TestDef, status: Status): NormTest['errors'] {
  if (status !== 'unexpected')
    return []
  const h = [...def.title].reduce((a, c) => a + c.charCodeAt(0), 0)
  return [{ message: ERROR_POOL[h % ERROR_POOL.length], stack: `at ${def.file}:${34 + (h % 20)}:${7 + (h % 12)}` }]
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
