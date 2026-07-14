import type { NormTest, RunReport, TestHistory } from '@kinora/core'
import { IngestError, SCHEMA_VERSION } from '@kinora/core'
import { describe, expect, it, vi } from 'vitest'
import { registerTools } from '../src/tools'

type Handler = (args: any) => Promise<{ content: { text: string }[], isError?: boolean }> | { content: { text: string }[], isError?: boolean }

function harness(client: any) {
  const handlers = new Map<string, Handler>()
  const server = { registerTool: (name: string, _cfg: unknown, h: Handler) => handlers.set(name, h) }
  registerTools(server as any, client)
  return async (name: string, args: any = {}) => {
    const res = await handlers.get(name)!(args)
    return { isError: res.isError ?? false, data: res.isError ? res.content[0].text : JSON.parse(res.content[0].text) }
  }
}

function failing(over: Partial<NormTest> = {}): NormTest {
  return {
    testKey: 'k1',
    title: 'purchase',
    titlePath: [],
    file: 'a.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    status: 'unexpected',
    ok: false,
    duration: 1,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [{ message: 'boom' }],
    attachments: [{ name: 'trace', contentType: 'application/zip', hasBody: true, url: 'https://x/t.zip' }],
    ...over,
  }
}

function report(tests: NormTest[]): RunReport {
  return { schemaVersion: SCHEMA_VERSION, runId: 'r1', projectId: 'p', startedAt: '2026-07-14T00:00:00.000Z', duration: 1, counts: { total: tests.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, meta: {}, tests }
}

function hist(over: Partial<TestHistory>): TestHistory {
  return { testKey: 'k', title: 't', titlePath: [], file: 'f', projectName: 'c', points: [], runs: 1, passed: 1, failed: 0, flaky: 0, skipped: 0, executed: 1, flakyRate: 0, failRate: 0, passRate: 1, recentFlakyRate: 0, recentFailRate: 0, newlyFlaky: false, newlyBroken: false, lastStatus: 'expected', ...over }
}

describe('list_failures', () => {
  it('formats the failures returned by the client', async () => {
    const call = harness({ getFailures: vi.fn().mockResolvedValue({ runId: 'r1', startedAt: 's', counts: {}, failures: [failing()] }) })
    const { data } = await call('list_failures', { project: 'p' })
    expect(data.failures[0].location).toBe('a.ts:1:1')
    expect(data.failures[0].traceUrl).toBe('https://x/t.zip')
  })

  it('surfaces the server error message', async () => {
    const call = harness({ getFailures: vi.fn().mockRejectedValue(new IngestError(404, 'Project not found')) })
    const { isError, data } = await call('list_failures', { project: 'nope' })
    expect(isError).toBe(true)
    expect(data).toContain('Project not found')
  })
})

describe('get_run', () => {
  it('counts flaky tests (ok=true) as failures', async () => {
    const flaky = failing({ testKey: 'fk', status: 'flaky', ok: true })
    const passed = failing({ testKey: 'ok', status: 'expected', ok: true, errors: [], attachments: [] })
    const call = harness({ getRun: vi.fn().mockResolvedValue(report([flaky, passed])) })
    const { data } = await call('get_run', { project: 'p' })
    expect(data.failures.map((f: any) => f.testKey)).toEqual(['fk'])
    expect(data.tests).toHaveLength(2)
  })
})

describe('test_history', () => {
  it('with no testKey/query returns only unstable tests', async () => {
    const histories = [hist({ testKey: 'stable', passed: 3 }), hist({ testKey: 'flaky', flaky: 2, lastStatus: 'flaky' })]
    const call = harness({ getHistory: vi.fn().mockResolvedValue(histories) })
    const { data } = await call('test_history', { project: 'p' })
    expect(data.histories.map((h: any) => h.testKey)).toEqual(['flaky'])
  })

  it('with query filters by title substring', async () => {
    const histories = [hist({ testKey: 'a', title: 'login flow' }), hist({ testKey: 'b', title: 'checkout' })]
    const call = harness({ getHistory: vi.fn().mockResolvedValue(histories) })
    const { data } = await call('test_history', { project: 'p', query: 'CHECK' })
    expect(data.histories.map((h: any) => h.testKey)).toEqual(['b'])
  })

  it('with testKey passes it through to the client', async () => {
    const getHistory = vi.fn().mockResolvedValue([hist({ testKey: 'k1' })])
    const call = harness({ getHistory })
    await call('test_history', { project: 'p', testKey: 'k1' })
    expect(getHistory).toHaveBeenCalledWith('p', 'k1')
  })
})

describe('get_trace', () => {
  it('returns the trace url for a test', async () => {
    const call = harness({ getRun: vi.fn().mockResolvedValue(report([failing()])) })
    const { data } = await call('get_trace', { project: 'p', testKey: 'k1' })
    expect(data.traceUrl).toBe('https://x/t.zip')
  })

  it('errors when the test is missing', async () => {
    const call = harness({ getRun: vi.fn().mockResolvedValue(report([failing()])) })
    const { isError } = await call('get_trace', { project: 'p', testKey: 'ghost' })
    expect(isError).toBe(true)
  })

  it('errors when no trace is attached', async () => {
    const call = harness({ getRun: vi.fn().mockResolvedValue(report([failing({ attachments: [] })])) })
    const { isError, data } = await call('get_trace', { project: 'p', testKey: 'k1' })
    expect(isError).toBe(true)
    expect(data).toContain('no trace')
  })
})
