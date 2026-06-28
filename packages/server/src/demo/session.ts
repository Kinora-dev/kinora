import { Hono } from 'hono'
import { auth } from '../lib/auth'
import { demo } from '../lib/env'
import { DEMO_PASSWORD, resolveDemoOwner } from './owner'

export const demoApp = new Hono()

// Sign the seeded demo account in here so the browser gets a real (read-only) session cookie:
// better-auth client calls (org, members, role) need it; the tRPC fallback alone wouldn't cover them.
demoApp.get('/session', async (c) => {
  if (!demo)
    return c.body(null, 204)

  const owner = await resolveDemoOwner()
  if (!owner)
    return c.body(null, 204)

  const res = await auth.api.signInEmail({ body: { email: owner.user.email, password: DEMO_PASSWORD }, asResponse: true })
  for (const cookie of res.headers.getSetCookie())
    c.header('set-cookie', cookie, { append: true })
  return c.body(null, 204)
})
