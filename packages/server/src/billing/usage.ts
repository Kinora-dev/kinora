import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '../db'
import { project, run, test } from '../db/schemas/index'

export function startOfMonthUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

// Usage is attributed to when tests ran (run.startedAt), not upload time, so historical
// backfill imports land in past periods and don't consume the current month's quota.
export async function currentPeriodResults(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(test)
    .innerJoin(run, eq(test.runId, run.id))
    .innerJoin(project, eq(test.projectId, project.id))
    .where(and(eq(project.organizationId, organizationId), gte(run.startedAt, startOfMonthUtc())))

  return row?.total ?? 0
}

export async function projectCount(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(project)
    .where(eq(project.organizationId, organizationId))

  return row?.total ?? 0
}
