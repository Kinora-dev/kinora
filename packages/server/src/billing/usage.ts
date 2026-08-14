import { and, count, eq, gte, sum } from 'drizzle-orm'
import { db } from '../db'
import { artifact, project, run, test } from '../db/schemas/index'

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

// Bytes currently stored for an org. Retention purges shrink it, so it is a live total, not a period one.
export async function storageBytes(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(artifact.size) })
    .from(artifact)
    .innerJoin(project, eq(artifact.projectId, project.id))
    .where(eq(project.organizationId, organizationId))

  return Number(row?.total ?? 0)
}

export async function projectCount(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(project)
    .where(eq(project.organizationId, organizationId))

  return row?.total ?? 0
}
