import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { rateLimit } from '../src/lib/rate-limit'

function appWith(limit: number) {
  const app = new Hono()
  app.use('*', rateLimit({ windowMs: 60_000, limit, key: c => c.req.header('x-id') ?? 'shared' }))
  app.get('/', c => c.text('ok'))
  return app
}

describe('rateLimit', () => {
  it('allows up to the limit then returns 429 with Retry-After', async () => {
    const app = appWith(3)
    for (let i = 0; i < 3; i++)
      expect((await app.request('/', { headers: { 'x-id': 'a' } })).status).toBe(200)
    const blocked = await app.request('/', { headers: { 'x-id': 'a' } })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
  })

  it('tracks each key independently', async () => {
    const app = appWith(1)
    expect((await app.request('/', { headers: { 'x-id': 'a' } })).status).toBe(200)
    expect((await app.request('/', { headers: { 'x-id': 'a' } })).status).toBe(429)
    expect((await app.request('/', { headers: { 'x-id': 'b' } })).status).toBe(200)
  })
})
