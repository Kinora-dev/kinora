import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '../db'
import { project, test } from '../db/schemas/index'

function startOfMonthUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

// Test results ingested by the user since the start of the current UTC month.
export async function currentPeriodResults(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(test)
    .innerJoin(project, eq(test.projectId, project.id))
    .where(and(eq(project.userId, userId), gte(test.createdAt, startOfMonthUtc())))

  return row?.total ?? 0
}

export async function projectCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(project)
    .where(eq(project.userId, userId))

  return row?.total ?? 0
}
