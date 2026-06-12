import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { member } from '../db/schemas/index'
import { auth } from '../lib/auth'

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

  return { user, organizationId, req }
}

export type Context = Awaited<ReturnType<typeof createContext>>
