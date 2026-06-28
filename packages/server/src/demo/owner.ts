import { asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { member, user as userTable } from '../db/schemas/index'

// Seed-market sets this on the demo account; the auto-session signs in with it. Keep in sync there.
export const DEMO_PASSWORD = 'password123'

// The seeded primary account = earliest org owner. Looked up per-request (not cached) so the
// daily reseed's new ids are picked up without a restart.
export async function resolveDemoOwner() {
  const [owner] = await db
    .select({ user: userTable, organizationId: member.organizationId })
    .from(member)
    .innerJoin(userTable, eq(member.userId, userTable.id))
    .where(eq(member.role, 'owner'))
    .orderBy(asc(userTable.createdAt))
    .limit(1)
  return owner ?? null
}
