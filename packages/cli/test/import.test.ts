import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importReports } from '../src/import'

const RAW = {
  config: { version: '1.60.0' },
  stats: { startTime: '2026-01-01T00:00:00.000Z', duration: 1000, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
  suites: [
    {
      title: 'a.spec.ts',
      file: 'a.spec.ts',
      specs: [
        { title: 'passes', ok: true, tags: [], file: 'a.spec.ts', line: 3, column: 1, tests: [{ status: 'expected', projectName: 'chromium', results: [{ status: 'passed', duration: 5 }] }] },
      ],
    },
  ],
}

function okResponse() {
  return new Response(JSON.stringify({ projectId: 'p', runId: 'r', tests: 1 }), { status: 201 })
}

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kinora-import-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

describe('importReports', () => {
  it('uploads every results.json under the dir as backfill runs', async () => {
    await writeFile(join(dir, 'a.json'), JSON.stringify(RAW))
    await writeFile(join(dir, 'b.json'), JSON.stringify(RAW))
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const res = await importReports({ dir, project: { slug: 'web-app' }, url: 'https://api.example.com', token: 't' })
    expect(res).toEqual({ imported: 2, failed: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://api.example.com/api/v1/runs?backfill=1')
  })

  it('counts a malformed report as failed and still imports the rest', async () => {
    await writeFile(join(dir, 'good.json'), JSON.stringify(RAW))
    await writeFile(join(dir, 'bad.json'), '{ not valid json')
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()))

    const res = await importReports({ dir, project: { slug: 'web-app' }, url: 'https://api.example.com', token: 't' })
    expect(res.imported).toBe(1)
    expect(res.failed).toBe(1)
  })

  it('returns zero when the directory has no json', async () => {
    await writeFile(join(dir, 'notes.txt'), 'hi')
    const res = await importReports({ dir, project: { slug: 'web-app' }, url: 'https://api.example.com', token: 't' })
    expect(res).toEqual({ imported: 0, failed: 0 })
  })
})
