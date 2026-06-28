import type { SessionUser } from '@/lib/session'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '@/lib/session'

// vitest hoists vi.hoisted + vi.mock above the imports, so trpc is mocked before session loads it.
const { meQuery } = vi.hoisted(() => ({ meQuery: vi.fn() }))
vi.mock('@/lib/trpc', () => ({ trpc: { user: { me: { query: meQuery } } } }))

function fakeUser(id: string): SessionUser {
  return { id } as unknown as SessionUser
}

describe('session', () => {
  beforeEach(() => {
    meQuery.mockReset()
  })

  it('setUser updates the user ref', () => {
    session.setUser(fakeUser('u1'))
    expect(session.user.value?.id).toBe('u1')
  })

  it('refresh loads the user from trpc', async () => {
    meQuery.mockResolvedValue({ id: 'u2' })
    await session.refresh()
    expect(session.user.value?.id).toBe('u2')
  })

  it('refresh falls back to null on error', async () => {
    meQuery.mockRejectedValue(new Error('network'))
    await session.refresh()
    expect(session.user.value).toBeNull()
  })

  it('ensure boots once and caches the in-flight promise', async () => {
    meQuery.mockResolvedValue({ id: 'u3' })
    await session.ensure()
    await session.ensure() // cached: no second query
    expect(meQuery).toHaveBeenCalledTimes(1)
    expect(session.user.value?.id).toBe('u3')
  })
})
