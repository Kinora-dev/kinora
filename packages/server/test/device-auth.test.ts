import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { describe, expect, it } from 'vitest'
import { auth } from '../src/lib/auth'
import { createContext } from '../src/trpc/context'
import { createUser } from './helpers'

const CLIENT_ID = 'kinora-desktop'
const GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

async function signInToken(email: string, password = 'password123'): Promise<string> {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true })
  const token = res.headers.get('set-auth-token')
  if (!token)
    throw new Error('no set-auth-token header')
  return token
}

describe('device authorization flow', () => {
  it('code -> claim -> approve -> token, and the token authenticates the dashboard', async () => {
    const user = await createUser('a@test.dev')
    const headers = new Headers({ Authorization: `Bearer ${await signInToken('a@test.dev')}` })

    const code = await auth.api.deviceCode({ body: { client_id: CLIENT_ID, scope: 'openid profile email' } })
    expect(code.device_code).toBeTruthy()
    expect(code.user_code).toBeTruthy()

    // The signed-in browser claims the code, then approves it.
    await auth.api.deviceVerify({ query: { user_code: code.user_code }, headers })
    await auth.api.deviceApprove({ body: { userCode: code.user_code }, headers })

    const tok = await auth.api.deviceToken({ body: { grant_type: GRANT, device_code: code.device_code, client_id: CLIENT_ID } })
    expect(tok.access_token).toBeTruthy()

    // The access token works as a Bearer for dashboard auth (via the bearer plugin).
    const ctx = await createContext({
      req: new Request('http://test', { headers: { Authorization: `Bearer ${tok.access_token}` } }),
    } as FetchCreateContextFnOptions)
    expect(ctx.user?.id).toBe(user.id)
  })

  it('rejects approve before the code is claimed', async () => {
    await createUser('a@test.dev')
    const headers = new Headers({ Authorization: `Bearer ${await signInToken('a@test.dev')}` })
    const code = await auth.api.deviceCode({ body: { client_id: CLIENT_ID } })

    await expect(auth.api.deviceApprove({ body: { userCode: code.user_code }, headers })).rejects.toThrow()
  })

  it('token endpoint stays pending until approved', async () => {
    await createUser('a@test.dev')
    const code = await auth.api.deviceCode({ body: { client_id: CLIENT_ID } })

    await expect(auth.api.deviceToken({ body: { grant_type: GRANT, device_code: code.device_code, client_id: CLIENT_ID } })).rejects.toThrow()
  })
})
