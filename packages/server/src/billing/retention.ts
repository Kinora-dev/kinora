import { and, eq, inArray, lt, notInArray } from 'drizzle-orm'
import { db } from '../db'
import { artifact, project, run, subscription } from '../db/schemas/index'
import { cloud } from '../lib/env'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'
import { retentionDaysFor } from './entitlements'

const BATCH = 500
const DAY_MS = 24 * 60 * 60 * 1000

interface Scope {
  includeUsers?: string[]
  excludeUsers?: string[]
}

function cutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

async function purgeScope(before: Date, scope: Scope): Promise<number> {
  // A tier with no users on it: nothing to do.
  if (scope.includeUsers && scope.includeUsers.length === 0)
    return 0

  let total = 0
  let fetched = BATCH
  while (fetched === BATCH) {
    const conds = [lt(run.startedAt, before)]
    if (scope.includeUsers)
      conds.push(inArray(project.userId, scope.includeUsers))
    if (scope.excludeUsers && scope.excludeUsers.length > 0)
      conds.push(notInArray(project.userId, scope.excludeUsers))

    const batch = await db
      .select({ id: run.id })
      .from(run)
      .innerJoin(project, eq(run.projectId, project.id))
      .where(and(...conds))
      .limit(BATCH)

    fetched = batch.length
    if (fetched === 0)
      break

    const ids = batch.map(b => b.id)

    // Blobs first: the run delete cascades the artifact rows, taking the keys with it.
    const blobs = await db
      .select({ key: artifact.storageKey })
      .from(artifact)
      .where(inArray(artifact.runId, ids))
    for (const blob of blobs) {
      try {
        await storage.delete(blob.key)
      }
      catch (error) {
        logger.error({ error, key: blob.key }, 'retention: blob delete failed')
      }
    }

    await db.delete(run).where(inArray(run.id, ids))
    total += fetched
  }

  return total
}

// Delete runs (cascading tests + artifacts + their blobs) past each tier's retention window.
export async function purgeExpiredRuns(now: Date): Promise<{ deleted: number }> {
  if (!cloud)
    return { deleted: 0 } // self-host keeps everything

  const subs = await db
    .select({ userId: subscription.userId, tier: subscription.tier })
    .from(subscription)

  const teamUsers = subs.filter(s => s.tier === 'team').map(s => s.userId)
  const proUsers = subs.filter(s => s.tier === 'pro').map(s => s.userId)
  const paidUsers = subs
    .filter(s => s.tier === 'team' || s.tier === 'pro' || s.tier === 'enterprise')
    .map(s => s.userId)

  let deleted = 0
  // free = everyone not on a paid plan (covers no subscription + tier 'free').
  deleted += await purgeScope(cutoff(now, retentionDaysFor('free')), { excludeUsers: paidUsers })
  deleted += await purgeScope(cutoff(now, retentionDaysFor('team')), { includeUsers: teamUsers })
  deleted += await purgeScope(cutoff(now, retentionDaysFor('pro')), { includeUsers: proUsers })
  // enterprise retention is unlimited: never purged.
  return { deleted }
}
