import { describe, expect, it, vi } from 'vitest'
import { app } from '../src/app'
import { logger } from '../src/lib/logger'

describe('access log', () => {
  it('logs method, path, and status for an /api/v1 request', async () => {
    const spy = vi.spyOn(logger, 'info')
    await app.request('/api/v1/runs', { method: 'POST' }) // 401: no API key

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/api/v1/runs', status: 401 }),
      'request',
    )
    spy.mockRestore()
  })

  it('logs /api/slack requests', async () => {
    const spy = vi.spyOn(logger, 'info')
    await app.request('/api/slack/install') // 401/404: no session

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/slack/install' }),
      'request',
    )
    spy.mockRestore()
  })
})
