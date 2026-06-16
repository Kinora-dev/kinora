import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { describe, expect, it } from 'vitest'
import { auth } from '../src/lib/auth'
import { createContext } from '../src/trpc/context'
import { createUser, ownedOrgId } from './helpers'

// The bearer plugin returns the session token in the set-auth-token header on sign-in.
async function signInToken(email: string, password = 'password123'): Promise<string> {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true })
  const token = res.headers.get('set-auth-token')
  if (!token)
    throw new Error('no set-auth-token header (bearer plugin not active?)')
  return token
}

function ctxFor(authorization?: string) {
  const headers = new Headers()
  if (authorization)
    headers.set('Authorization', authorization)
  return createContext({ req: new Request('http://test', { headers }) } as FetchCreateContextFnOptions)
}

describe('bearer auth (desktop)', () => {
  it('resolves the session user + org from an Authorization: Bearer session token', async () => {
    const user = await createUser('a@test.dev')
    const token = await signInToken('a@test.dev')

    const ctx = await ctxFor(`Bearer ${token}`)
    expect(ctx.user?.id).toBe(user.id)
    expect(ctx.organizationId).toBe(await ownedOrgId(user.id))
  })

  it('no or invalid bearer token -> unauthenticated context', async () => {
    await createUser('a@test.dev')
    expect((await ctxFor()).user).toBeNull()
    expect((await ctxFor('Bearer not-a-real-token')).user).toBeNull()
  })
})
