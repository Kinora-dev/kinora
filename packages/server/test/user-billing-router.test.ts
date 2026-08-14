import type { AuthType } from '../src/lib/auth'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { db } from '../src/db'
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
    expect(me).not.toHaveProperty('mailerEnabled') // server caps moved to config.get
    expect(me?.role).toBe('user') // exposed for the platform-admin gate; 'user' (not 'admin') for non-admins
  })
})

describe('config.get', () => {
  it('returns server capability flags', async () => {
    const u = await createUser()
    const cfg = await (await caller(u)).config.get()
    expect(typeof cfg.mailerEnabled).toBe('boolean')
    expect(typeof cfg.slackOauthEnabled).toBe('boolean')
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

  it('reports the bytes an uploaded artifact takes, and null for an unlimited plan', async () => {
    const u = await createUser()
    const apiKey = await createApiKey(u.id)
    await ingest(apiKey)
    const r = (await db.query.run.findMany())[0]

    const form = new FormData()
    form.set('file', new File([new Uint8Array(64)], 'trace.zip'))
    form.set('name', 'trace')
    await app.request(`/api/v1/runs/${r.id}/artifacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    const s = await (await caller(u)).billing.summary()
    expect(s.usedStorageBytes).toBe(64)
    expect(s.storageBytes).toBeNull() // self-host: unlimited crosses the wire as null
  })
})
