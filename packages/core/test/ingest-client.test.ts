import type { IngestRun } from '../src/index'
import { describe, expect, it } from 'vitest'
import { createIngestClient, IngestError } from '../src/index'

const PAYLOAD: IngestRun = {
  project: { slug: 'web-app', name: 'web-app' },
  run: {
    startedAt: '2026-01-01T00:00:00.000Z',
    duration: 0,
    counts: { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
  },
  tests: [],
}

function clientWith(response: Response) {
  return createIngestClient({ baseUrl: 'http://test', token: 't', fetch: async () => response })
}

describe('createIngestClient.uploadRun', () => {
  it('surfaces the server error message on 402', async () => {
    const client = clientWith(
      new Response(JSON.stringify({ error: 'Free plan limit reached. Upgrade.', limit: 2500 }), { status: 402 }),
    )
    const err = await client.uploadRun(PAYLOAD).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(IngestError)
    expect((err as IngestError).status).toBe(402)
    expect((err as IngestError).message).toBe('Free plan limit reached. Upgrade.')
  })

  it('falls back to the raw body when it is not JSON', async () => {
    const client = clientWith(new Response('upstream exploded', { status: 500 }))
    const err = await client.uploadRun(PAYLOAD).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(IngestError)
    expect((err as IngestError).status).toBe(500)
    expect((err as IngestError).message).toBe('upstream exploded')
  })

  it('returns the parsed result on success', async () => {
    const client = clientWith(
      new Response(JSON.stringify({ projectId: 'p1', runId: 'r1', tests: 3 }), { status: 201 }),
    )
    await expect(client.uploadRun(PAYLOAD)).resolves.toEqual({ projectId: 'p1', runId: 'r1', tests: 3 })
  })
})
