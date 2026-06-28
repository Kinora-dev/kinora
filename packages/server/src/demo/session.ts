import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'
import { member, user as userTable } from '../db/schemas/index'
import { auth } from '../lib/auth'
import { demo } from '../lib/env'

// The seed gives the demo account this password; signing it in here gives the browser a real
// (read-only) session cookie so better-auth client calls (org, members, role) work too.
const DEMO_PASSWORD = 'password123'

export const demoApp = new Hono()

demoApp.get('/session', async (c) => {
  if (!demo)
    return c.body(null, 204)

  // The seeded primary account = earliest owner (same rule as the tRPC auto-session).
  const [owner] = await db
    .select({ email: userTable.email })
    .from(member)
    .innerJoin(userTable, eq(member.userId, userTable.id))
    .where(eq(member.role, 'owner'))
    .orderBy(asc(userTable.createdAt))
    .limit(1)
  if (!owner)
    return c.body(null, 204)

  const res = await auth.api.signInEmail({ body: { email: owner.email, password: DEMO_PASSWORD }, asResponse: true })
  for (const cookie of res.headers.getSetCookie())
    c.header('set-cookie', cookie, { append: true })
  return c.body(null, 204)
})
