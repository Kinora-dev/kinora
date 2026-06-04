import type { NormTest, RunReport } from '@/contracts/playback'
import { describe, expect, it } from 'vitest'
import { buildTestHistories, byInstability, isUnstable } from './history'

function makeTest(over: Partial<NormTest> & { testKey: string, status: NormTest['status'] }): NormTest {
  return {
    title: 't',
    titlePath: ['t'],
    file: 'f.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    ok: true,
    duration: 100,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
    ...over,
  }
}

function makeReport(runId: string, startedAt: string, tests: NormTest[]): RunReport {
  return {
    schemaVersion: 1,
    runId,
    projectId: 'p',
    startedAt,
    duration: 0,
    counts: { total: tests.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
    meta: {},
    tests,
  }
}

describe('buildTestHistories', () => {
  it('orders points chronologically regardless of input order', () => {
    const r2 = makeReport('r2', '2026-01-02T00:00:00Z', [makeTest({ testKey: 'K', status: 'unexpected' })])
    const r1 = makeReport('r1', '2026-01-01T00:00:00Z', [makeTest({ testKey: 'K', status: 'expected' })])
    const [h] = buildTestHistories([r2, r1])
    expect(h.points.map(p => p.runId)).toEqual(['r1', 'r2'])
    expect(h.lastStatus).toBe('unexpected')
  })

  it('computes rates with skipped excluded from the denominator', () => {
    const runs = [
      makeReport('r1', '2026-01-01T00:00:00Z', [makeTest({ testKey: 'K', status: 'expected' })]),
      makeReport('r2', '2026-01-02T00:00:00Z', [makeTest({ testKey: 'K', status: 'flaky' })]),
      makeReport('r3', '2026-01-03T00:00:00Z', [makeTest({ testKey: 'K', status: 'unexpected' })]),
      makeReport('r4', '2026-01-04T00:00:00Z', [makeTest({ testKey: 'K', status: 'skipped' })]),
    ]
    const [h] = buildTestHistories(runs)
    expect(h.runs).toBe(4)
    expect(h.executed).toBe(3)
    expect(h.passed).toBe(1)
    expect(h.flaky).toBe(1)
    expect(h.failed).toBe(1)
    expect(h.flakyRate).toBeCloseTo(1 / 3)
    expect(h.failRate).toBeCloseTo(1 / 3)
    expect(h.passRate).toBeCloseTo(2 / 3) // flaky counts as pass
  })

  it('only records points for runs where the test is present', () => {
    const runs = [
      makeReport('r1', '2026-01-01T00:00:00Z', [
        makeTest({ testKey: 'A', status: 'expected' }),
        makeTest({ testKey: 'B', status: 'expected' }),
      ]),
      makeReport('r2', '2026-01-02T00:00:00Z', [makeTest({ testKey: 'A', status: 'expected' })]),
    ]
    const b = buildTestHistories(runs).find(h => h.testKey === 'B')
    expect(b?.runs).toBe(1)
  })

  it('flags unstable on fail or flaky only', () => {
    const [stable] = buildTestHistories([makeReport('r1', '2026-01-01T00:00:00Z', [makeTest({ testKey: 'K', status: 'expected' })])])
    const [flaky] = buildTestHistories([makeReport('r1', '2026-01-01T00:00:00Z', [makeTest({ testKey: 'K', status: 'flaky' })])])
    expect(isUnstable(stable)).toBe(false)
    expect(isUnstable(flaky)).toBe(true)
  })

  it('ranks failures above flakiness', () => {
    const failing = buildTestHistories([makeReport('r1', '2026-01-01T00:00:00Z', [makeTest({ testKey: 'F', status: 'unexpected' })])])[0]
    const flaky = buildTestHistories([makeReport('r1', '2026-01-01T00:00:00Z', [makeTest({ testKey: 'L', status: 'flaky' })])])[0]
    expect([flaky, failing].sort(byInstability)[0].testKey).toBe('F')
  })
})
