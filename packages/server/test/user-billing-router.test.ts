import type { AuthType } from '../src/lib/auth'
import { beforeEach, describe, expect, it } from 'vitest'
import { appRouter } from '../src/router/index'
import { caller, createApiKey, createUser, ingest, resetDb } from './helpers'

beforeEach(resetDb)

describe('user.me', () => {
  it('returns null when unauthenticated', async () => {
    const anon = appRouter.createCaller({ user: null as AuthType['user'], organizationId: '', req: new Request('http://test') })
    expect(await anon.user.me()).toBeNull()
  })

  it('returns the user with hasPassword + mailerEnabled when signed in', async () => {
    const u = await createUser()
    const me = await (await caller(u)).user.me()
    expect(me?.id).toBe(u.id)
    expect(me?.hasPassword).toBe(true) // created via email/password signup
    expect(typeof me?.mailerEnabled).toBe('boolean')
  })
})

describe('billing.summary', () => {
  it('returns tier, limits, and usage for the org', async () => {
    const u = await createUser()
    await ingest(await createApiKey(u.id))

    const s = await (await caller(u)).billing.summary()
    expect(s.tier).toBeTruthy()
    expect(s).toHaveProperty('usedResults')
    expect(s).toHaveProperty('maxProjects')
    expect(s).toHaveProperty('retentionDays')
  })
})
