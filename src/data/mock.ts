import type {
  Counts,
  Manifest,
  NormTest,
  ProjectEntry,
  RunReport,
  RunSummary,
} from '@/contracts/playback'
import { SCHEMA_VERSION } from '@/contracts/playback'
import { makeTestKey } from '@/lib/test-key'
import type { PwTestStatus } from '@/contracts/playwright'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface MockProject {
  id: string
  name: string
  description: string
  browsers: string[]
  files: { file: string; titles: string[] }[]
  runs: number
}

const PROJECTS: MockProject[] = [
  {
    id: 'web-app',
    name: 'Web App E2E',
    description: 'Core user journeys on the marketing + app surface',
    browsers: ['chromium', 'firefox', 'webkit'],
    runs: 30,
    files: [
      { file: 'tests/auth.spec.ts', titles: ['login with valid creds', 'logout', 'reset password', 'sso redirect'] },
      { file: 'tests/dashboard.spec.ts', titles: ['renders widgets', 'filters by date', 'exports csv'] },
      { file: 'tests/search.spec.ts', titles: ['returns results', 'handles empty state', 'debounces input'] },
    ],
  },
  {
    id: 'checkout-flow',
    name: 'Checkout Flow',
    description: 'Payment + cart critical path, runs nightly',
    browsers: ['chromium', 'webkit'],
    runs: 30,
    files: [
      { file: 'tests/cart.spec.ts', titles: ['add item', 'update quantity', 'remove item'] },
      { file: 'tests/payment.spec.ts', titles: ['card payment', 'paypal', '3ds challenge', 'declined card'] },
    ],
  },
  {
    id: 'mobile-web',
    name: 'Mobile Web',
    description: 'Responsive smoke suite on mobile viewports',
    browsers: ['chromium'],
    runs: 24,
    files: [{ file: 'tests/nav.spec.ts', titles: ['hamburger menu', 'bottom sheet', 'sticky cta'] }],
  },
]

const DAY = 86_400_000

function pickStatus(rnd: () => number, healthy: number): PwTestStatus {
  const r = rnd()
  if (r < healthy) return 'expected'
  if (r < healthy + 0.05) return 'skipped'
  if (r < healthy + 0.11) return 'flaky'
  return 'unexpected'
}

function buildTests(p: MockProject, seed: number): NormTest[] {
  const rnd = mulberry32(seed)
  // Run health drifts so charts show trends.
  const healthy = 0.82 + rnd() * 0.16
  const tests: NormTest[] = []
  for (const browser of p.browsers) {
    for (const f of p.files) {
      f.titles.forEach((title, i) => {
        const status = pickStatus(rnd, healthy)
        const titlePath = [title]
        tests.push({
          testKey: makeTestKey(f.file, titlePath, browser),
          title,
          titlePath,
          file: f.file,
          line: 10 + i * 12,
          column: 3,
          projectName: browser,
          status,
          ok: status === 'expected' || status === 'flaky',
          duration: Math.round(400 + rnd() * 5200),
          retries: status === 'flaky' ? 1 : 0,
          tags: i === 0 ? ['@smoke'] : [],
          annotations: status === 'skipped' ? [{ type: 'skip', description: 'flaky on CI' }] : [],
          errors:
            status === 'unexpected'
              ? [
                  {
                    message: `expect(received).toBeVisible()\n\nLocator: getByRole('button', { name: '${title}' })`,
                    location: { file: f.file, line: 10 + i * 12, column: 3 },
                  },
                ]
              : [],
          attachments:
            status === 'unexpected'
              ? [
                  { name: 'screenshot', contentType: 'image/png', path: 'screenshot.png', hasBody: false },
                  { name: 'trace', contentType: 'application/zip', path: 'trace.zip', hasBody: false },
                ]
              : [],
        })
      })
    }
  }
  return tests
}

function countsFrom(tests: NormTest[]): Counts {
  const c: Counts = { total: tests.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0 }
  for (const t of tests) c[t.status]++
  return c
}

function runIdFor(day: number): string {
  return `2026-${String(((day % 12) + 1)).padStart(2, '0')}-run-${day}`
}

function buildManifest(now: number): Manifest {
  const projects: ProjectEntry[] = PROJECTS.map((p) => {
    const runs: RunSummary[] = []
    for (let d = p.runs - 1; d >= 0; d--) {
      const seed = hashSeed(`${p.id}:${d}`)
      const tests = buildTests(p, seed)
      const counts = countsFrom(tests)
      const startedAt = new Date(now - d * DAY).toISOString()
      const runId = runIdFor(p.runs - d)
      runs.push({
        runId,
        projectId: p.id,
        startedAt,
        duration: tests.reduce((s, t) => s + t.duration, 0),
        counts,
        playwrightVersion: '1.58.2',
        git: { branch: 'main', sha: seed.toString(16).slice(0, 7) },
        ci: { provider: 'github', runNumber: String(1000 + (p.runs - d)) },
        reportPath: `reports/${p.id}/${runId}.json`,
      })
    }
    return { id: p.id, name: p.name, description: p.description, runs }
  })
  return { schemaVersion: SCHEMA_VERSION, generatedAt: new Date(now).toISOString(), projects }
}

export function mockManifest(): Manifest {
  return buildManifest(Date.now())
}

export function mockRunReport(reportPath: string): RunReport {
  // reports/<projectId>/<runId>.json
  const m = reportPath.match(/reports\/([^/]+)\/(.+)\.json$/)
  const projectId = m?.[1] ?? PROJECTS[0].id
  const runId = m?.[2] ?? 'run-1'
  const p = PROJECTS.find((x) => x.id === projectId) ?? PROJECTS[0]
  const manifest = buildManifest(Date.now())
  const summary = manifest.projects
    .find((x) => x.id === projectId)
    ?.runs.find((r) => r.runId === runId)
  const dayIndex = summary
    ? Math.round((Date.now() - Date.parse(summary.startedAt)) / DAY)
    : 0
  const tests = buildTests(p, hashSeed(`${p.id}:${dayIndex}`))
  return {
    schemaVersion: SCHEMA_VERSION,
    runId,
    projectId,
    startedAt: summary?.startedAt ?? new Date().toISOString(),
    duration: summary?.duration ?? tests.reduce((s, t) => s + t.duration, 0),
    counts: countsFrom(tests),
    meta: { playwrightVersion: '1.58.2', git: summary?.git, ci: summary?.ci },
    tests,
  }
}
