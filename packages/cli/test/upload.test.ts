import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

    expect(res).toMatchObject({ projectId: 'p1', runId: 'r1', tests: 2 })
    expect(res.counts).toMatchObject({ total: 2 })
    expect(captured?.url).toBe('https://api.example.com/api/v1/runs')
    expect((captured?.init.headers as Record<string, string>).authorization).toBe('Bearer secret')

    const body = JSON.parse(captured!.init.body as string)
    expect(body.project).toEqual({ slug: 'web-app', name: 'web-app' })
    expect(body.tests).toHaveLength(2)
    expect(body.run.counts.total).toBe(2)
    expect(body.run.counts.unexpected).toBe(1)
  })

  it('uploads a video attachment only when --upload-attachments asks for it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kinora-cli-'))
    const videoPath = join(dir, 'video.webm')
    await writeFile(videoPath, Buffer.from('webm'))
    const spec = RAW.suites[0].specs[0]
    const raw = {
      ...RAW,
      suites: [{
        ...RAW.suites[0],
        specs: [{
          ...spec,
          tests: [{
            status: 'expected',
            projectName: 'chromium',
            results: [{ status: 'passed', duration: 5, attachments: [{ name: 'video', contentType: 'video/webm', path: videoPath }] }],
          }],
        }],
      }],
    }

    const calls: string[] = []
    const fetchMock = (async (url: string | URL | Request) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ projectId: 'p1', runId: 'r1', tests: 1 }), { status: 201 })
    }) as typeof globalThis.fetch
    const opts = { project: { slug: 'web-app' }, url: 'https://api.example.com', token: 'secret', fetch: fetchMock }

    await uploadReport(raw, opts)
    expect(calls.filter(u => u.endsWith('/artifacts'))).toHaveLength(0)

    await uploadReport(raw, { ...opts, uploadAttachments: ['trace', 'video'] })
    expect(calls.filter(u => u.endsWith('/artifacts'))).toHaveLength(1)

    await rm(dir, { recursive: true, force: true })
  })
})
