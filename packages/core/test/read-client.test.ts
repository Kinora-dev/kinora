import type { RunReport } from '../src/contracts/kinora'
import { describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION } from '../src/contracts/kinora'
import { createReadClient, IngestError } from '../src/index'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const runReport: RunReport = {
  schemaVersion: SCHEMA_VERSION,
  runId: 'r1',
  projectId: 'web-app',
  startedAt: '2026-07-14T00:00:00.000Z',
  duration: 10,
  counts: { total: 1, expected: 0, unexpected: 1, flaky: 0, skipped: 0 },
  meta: {},
  tests: [{
    testKey: 'k1',
    title: 't',
    titlePath: ['f.ts', 't'],
    file: 'f.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    status: 'unexpected',
    ok: false,
    duration: 10,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
  }],
}

describe('createReadClient', () => {
  it('builds the /api/v1 url, trims trailing slashes, and sends the bearer token', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ runs: [] }))
    const client = createReadClient({ baseUrl: 'https://api.kinora.dev//', token: 'secret', fetch })

    await client.getRuns('web app', 5)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.kinora.dev/api/v1/projects/web%20app/runs?limit=5')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret')
  })

  it('parses a run report and defaults runId to latest', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(runReport))
    const client = createReadClient({ baseUrl: 'https://x', token: 't', fetch })

    const r = await client.getRun('web-app')
    expect(fetch.mock.calls[0][0]).toBe('https://x/api/v1/projects/web-app/runs/latest')
    expect(r.runId).toBe('r1')
  })

  it('throws a clear version-mismatch error when the server report schema differs', async () => {
    const fetch = vi.fn().mockImplementation(() => jsonResponse({ ...runReport, schemaVersion: SCHEMA_VERSION + 1 }))
    const client = createReadClient({ baseUrl: 'https://x', token: 't', fetch })

    await expect(client.getRun('web-app')).rejects.toThrow(/schema v.*!= client/)
  })

  it('throws IngestError carrying the server error message on a non-ok response', async () => {
    const fetch = vi.fn().mockImplementation(() => jsonResponse({ error: 'Project not found' }, 404))
    const client = createReadClient({ baseUrl: 'https://x', token: 't', fetch })

    await expect(client.getFailures('nope')).rejects.toThrow(/Project not found/)
    await expect(client.getFailures('nope')).rejects.toBeInstanceOf(IngestError)
  })
})
