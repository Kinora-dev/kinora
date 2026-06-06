import { describe, expect, it } from 'vitest'
import { uploadReport } from '../src/upload'

const RAW = {
  config: { version: '1.60.0' },
  stats: { startTime: '2026-01-01T00:00:00.000Z', duration: 1000, expected: 1, unexpected: 1, flaky: 0, skipped: 0 },
  suites: [
    {
      title: 'a.spec.ts',
      file: 'a.spec.ts',
      specs: [
        { title: 'passes', ok: true, tags: [], file: 'a.spec.ts', line: 3, column: 1, tests: [{ status: 'expected', projectName: 'chromium', results: [{ status: 'passed', duration: 5 }] }] },
        { title: 'fails', ok: false, tags: ['@smoke'], file: 'a.spec.ts', line: 7, column: 1, tests: [{ status: 'unexpected', projectName: 'chromium', results: [{ status: 'failed', duration: 9, errors: [{ message: 'boom' }] }] }] },
      ],
    },
  ],
}

describe('uploadReport', () => {
  it('posts the normalized run to /api/v1/runs with the bearer token', async () => {
    let captured: { url: string, init: RequestInit } | undefined
    const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init! }
      return new Response(JSON.stringify({ projectId: 'p1', runId: 'r1', tests: 2 }), { status: 201 })
    }) as typeof globalThis.fetch

    const res = await uploadReport(RAW, {
      project: { slug: 'web-app' },
      url: 'https://api.example.com/',
      token: 'secret',
      fetch: fetchMock,
    })

    expect(res).toEqual({ projectId: 'p1', runId: 'r1', tests: 2 })
    expect(captured?.url).toBe('https://api.example.com/api/v1/runs')
    expect((captured?.init.headers as Record<string, string>).authorization).toBe('Bearer secret')

    const body = JSON.parse(captured!.init.body as string)
    expect(body.project).toEqual({ slug: 'web-app', name: 'web-app' })
    expect(body.tests).toHaveLength(2)
    expect(body.run.counts.total).toBe(2)
    expect(body.run.counts.unexpected).toBe(1)
  })
})
