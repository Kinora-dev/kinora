import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { db } from '../src/db'
import { member } from '../src/db/schemas/index'
import { auth } from '../src/lib/auth'
import { decodeState, encodeState } from '../src/slack/oauth'
import { createApiKey, createUser, ingest, ownedOrgId, resetDb } from './helpers'

describe('slack oauth state', () => {
  const payload = { projectId: 'p1', userId: 'u1', slug: 'web-app' }

  it('round-trips a signed state', () => {
    expect(decodeState(encodeState(payload))).toEqual(payload)
  })

  it('rejects a tampered signature', () => {
    const [body] = encodeState(payload).split('.')
    expect(decodeState(`${body}.deadbeefdeadbeef`)).toBeNull()
  })

  it('rejects a forged body kept under the original signature', () => {
    const sig = encodeState(payload).split('.')[1]
    const forged = Buffer.from(JSON.stringify({ ...payload, userId: 'attacker', exp: Date.now() + 10_000 })).toString('base64url')
    expect(decodeState(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(decodeState('garbage')).toBeNull()
    expect(decodeState('')).toBeNull()
  })
})

describe('slack oauth install role gate', () => {
  beforeEach(resetDb)

  async function sessionFor(email: string, organizationId: string): Promise<string> {
    const { headers } = await auth.api.signInEmail({
      body: { email, password: 'password123' },
      returnHeaders: true,
    })
    const cookie = headers.get('set-cookie')?.split(';')[0] ?? ''
    await auth.api.setActiveOrganization({ body: { organizationId }, headers: { cookie } })
    return cookie
  }

  async function setup() {
    const owner = await createUser('owner@test.dev')
    const orgId = await ownedOrgId(owner.id)
    await ingest(await createApiKey(owner.id))

    const mate = await createUser('mate@test.dev')
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: mate.id, role: 'member' })
    return { orgId, mate }
  }

  it('rejects a plain member with 403', async () => {
    const { orgId, mate } = await setup()
    const cookie = await sessionFor('mate@test.dev', orgId)

    const res = await app.request('/api/slack/install?projectId=web-app', { headers: { cookie } })
    expect(res.status).toBe(403)
    void mate
  })

  it('redirects an admin to the slack authorize url', async () => {
    const { orgId, mate } = await setup()
    await db.update(member).set({ role: 'admin' }).where(eq(member.userId, mate.id))
    const cookie = await sessionFor('mate@test.dev', orgId)

    const res = await app.request('/api/slack/install?projectId=web-app', { headers: { cookie } })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('slack.com/oauth/v2/authorize')
  })
})

describe('slack oauth callback', () => {
  beforeEach(resetDb)

  it('400 when code or state is missing', async () => {
    const res = await app.request('/api/slack/callback')
    expect(res.status).toBe(400)
  })

  it('400 on an invalid state', async () => {
    const res = await app.request('/api/slack/callback?code=x&state=not-a-valid-state')
    expect(res.status).toBe(400)
  })

  it('401 when the callback session is not the user who started the flow', async () => {
    const state = encodeState({ projectId: randomUUID(), userId: randomUUID(), slug: 'web-app' })
    const res = await app.request(`/api/slack/callback?code=x&state=${encodeURIComponent(state)}`)
    expect(res.status).toBe(401)
  })
})
