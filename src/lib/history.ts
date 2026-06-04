import type { PwTestStatus } from '@/contracts/playwright'
import type { RunReport } from '@/contracts/playback'

export interface TestPoint {
  runId: string
  startedAt: string
  status: PwTestStatus
  duration: number
  retries: number
  errorMessage?: string
}

export interface TestHistory {
  testKey: string
  title: string
  titlePath: string[]
  file: string
  projectName: string
  points: TestPoint[] // chronological, oldest first
  runs: number // runs where the test was present
  passed: number
  failed: number
  flaky: number
  skipped: number
  executed: number // runs - skipped
  flakyRate: number // flaky / executed
  failRate: number // failed / executed
  passRate: number // (passed + flaky) / executed
  lastStatus: PwTestStatus
}

// A test is interesting if it has ever failed or flaked.
export function isUnstable(h: TestHistory): boolean {
  return h.failed > 0 || h.flaky > 0
}

// Build per-test timelines from a project's run reports. Reports may arrive in
// any order; points are sorted chronologically. A test absent from a run simply
// has no point for it.
export function buildTestHistories(reports: RunReport[]): TestHistory[] {
  const byKey = new Map<string, TestHistory>()

  const sorted = [...reports].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))

  for (const report of sorted) {
    for (const t of report.tests) {
      let h = byKey.get(t.testKey)
      if (!h) {
        h = {
          testKey: t.testKey,
          title: t.title,
          titlePath: t.titlePath,
          file: t.file,
          projectName: t.projectName,
          points: [],
          runs: 0,
          passed: 0,
          failed: 0,
          flaky: 0,
          skipped: 0,
          executed: 0,
          flakyRate: 0,
          failRate: 0,
          passRate: 1,
          lastStatus: t.status,
        }
        byKey.set(t.testKey, h)
      }
      h.points.push({
        runId: report.runId,
        startedAt: report.startedAt,
        status: t.status,
        duration: t.duration,
        retries: t.retries,
        errorMessage: t.errors[0]?.message,
      })
    }
  }

  for (const h of byKey.values()) {
    for (const p of h.points) {
      h.runs++
      if (p.status === 'expected') h.passed++
      else if (p.status === 'unexpected') h.failed++
      else if (p.status === 'flaky') h.flaky++
      else h.skipped++
    }
    h.executed = h.runs - h.skipped
    const d = Math.max(1, h.executed)
    h.flakyRate = h.flaky / d
    h.failRate = h.failed / d
    h.passRate = h.executed === 0 ? 1 : (h.passed + h.flaky) / d
    h.lastStatus = h.points.at(-1)?.status ?? h.lastStatus
  }

  return [...byKey.values()]
}

// Most unstable first: weight failures above flakiness.
export function byInstability(a: TestHistory, b: TestHistory): number {
  const score = (h: TestHistory) => h.failRate * 2 + h.flakyRate
  return score(b) - score(a)
}
