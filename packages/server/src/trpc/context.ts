import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { AuthType } from '../lib/auth'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { member, user as userTable } from '../db/schemas/index'
import { auth } from '../lib/auth'
import { demo } from '../lib/env'

// Public demo: resolve the seeded primary account (earliest owner) so visitors browse with no login.
// Looked up per-request (not cached) so the daily reseed's new ids are picked up without a restart.
async function demoSession() {
  const [owner] = await db
    .select({ userId: member.userId, organizationId: member.organizationId })
    .from(member)
    .innerJoin(userTable, eq(member.userId, userTable.id))
    .where(eq(member.role, 'owner'))
    .orderBy(asc(userTable.createdAt))
    .limit(1)
  if (!owner)
    return null
  const u = await db.query.user.findFirst({ where: eq(userTable.id, owner.userId) })
  return u ? { user: u, organizationId: owner.organizationId } : null
}

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({ headers: req.headers })
  const user = session?.user ?? null
  let organizationId = session?.session.activeOrganizationId ?? null

  // Self-heal sessions with no active org (e.g. predating the org plugin): fall back to the owned org.
  if (user && !organizationId) {
    const owned = await db.query.member.findFirst({
      where: and(eq(member.userId, user.id), eq(member.role, 'owner')),
      columns: { organizationId: true },
    })
    organizationId = owned?.organizationId ?? null
  }

  if (!user && demo) {
    const d = await demoSession()
    // db row is structurally the session user; cast to the auth user type for ctx consistency.
    if (d)
      return { user: d.user as unknown as AuthType['user'], organizationId: d.organizationId, req }
  }

  return { user, organizationId, req }
}

export type Context = Awaited<ReturnType<typeof createContext>>
