import { and, desc, eq, inArray, lt, notInArray } from 'drizzle-orm'
import { db } from '../db'
import { artifact, project, run, subscription } from '../db/schemas/index'
import { cloud, retentionPolicy } from '../lib/env'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'
import { retentionDaysFor } from './entitlements'

const BATCH = 500
const DAY_MS = 24 * 60 * 60 * 1000

interface Scope {
  includeOrgs?: string[]
  excludeOrgs?: string[]
  projectIds?: string[]
}

function cutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

async function deleteBlobs(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await storage.delete(key)
    }
    catch (error) {
      logger.error({ error, key }, 'retention: blob delete failed')
    }
  }
}

export async function purgeScope(before: Date, scope: Scope): Promise<number> {
  // A tier with no users on it: nothing to do.
  if (scope.includeOrgs && scope.includeOrgs.length === 0)
    return 0

  let total = 0
  let fetched = BATCH
  while (fetched === BATCH) {
    const conds = [lt(run.startedAt, before)]
    if (scope.includeOrgs)
      conds.push(inArray(project.organizationId, scope.includeOrgs))
    if (scope.excludeOrgs && scope.excludeOrgs.length > 0)
      conds.push(notInArray(project.organizationId, scope.excludeOrgs))
    if (scope.projectIds)
      conds.push(inArray(run.projectId, scope.projectIds))

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
    await deleteBlobs(blobs.map(b => b.key))

    await db.delete(run).where(inArray(run.id, ids))
    total += fetched
  }

  return total
}

// Drop the blobs of older runs but keep the rows: pass rates, trends and flaky history survive,
// the attachment just loses its URL at read time.
export async function purgeArtifactsBefore(before: Date): Promise<number> {
  let total = 0
  let fetched = BATCH
  while (fetched === BATCH) {
    const batch = await db
      .select({ id: artifact.id, key: artifact.storageKey })
      .from(artifact)
      .innerJoin(run, eq(artifact.runId, run.id))
      .where(lt(run.startedAt, before))
      .limit(BATCH)

    fetched = batch.length
    if (fetched === 0)
      break

    await deleteBlobs(batch.map(b => b.key))
    await db.delete(artifact).where(inArray(artifact.id, batch.map(b => b.id)))
    total += fetched
  }

  return total
}

// Keep the newest `keep` runs of every project. Runs sharing the boundary timestamp are all kept.
export async function purgeBeyondLastRuns(keep: number): Promise<number> {
  if (keep <= 0)
    return 0

  const projects = await db.select({ id: project.id }).from(project)
  let deleted = 0
  for (const p of projects) {
    const [boundary] = await db
      .select({ startedAt: run.startedAt })
      .from(run)
      .where(eq(run.projectId, p.id))
      .orderBy(desc(run.startedAt))
      .offset(keep - 1)
      .limit(1)
    if (!boundary)
      continue
    deleted += await purgeScope(boundary.startedAt, { projectIds: [p.id] })
  }

  return deleted
}

export interface PurgeResult {
  deleted: number
  artifacts: number
}

async function purgeSelfHost(now: Date): Promise<PurgeResult> {
  if (!retentionPolicy)
    return { deleted: 0, artifacts: 0 } // unconfigured self-host keeps everything

  const { runDays, keepLastRuns, artifactDays } = retentionPolicy
  let deleted = 0
  if (runDays > 0)
    deleted += await purgeScope(cutoff(now, runDays), {})
  deleted += await purgeBeyondLastRuns(keepLastRuns)
  const artifacts = artifactDays > 0 ? await purgeArtifactsBefore(cutoff(now, artifactDays)) : 0
  return { deleted, artifacts }
}

// Delete runs (cascading tests + artifacts + their blobs) past each tier's retention window.
export async function purgeExpiredRuns(now: Date): Promise<PurgeResult> {
  if (!cloud)
    return purgeSelfHost(now)

  const subs = await db
    .select({ organizationId: subscription.organizationId, tier: subscription.tier })
    .from(subscription)

  const teamOrgs = subs.filter(s => s.tier === 'team').map(s => s.organizationId)
  const proOrgs = subs.filter(s => s.tier === 'pro').map(s => s.organizationId)
  const paidOrgs = subs
    .filter(s => s.tier === 'team' || s.tier === 'pro' || s.tier === 'enterprise')
    .map(s => s.organizationId)

  let deleted = 0
  // free = everyone not on a paid plan (covers no subscription + tier 'free').
  deleted += await purgeScope(cutoff(now, retentionDaysFor('free')), { excludeOrgs: paidOrgs })
  deleted += await purgeScope(cutoff(now, retentionDaysFor('team')), { includeOrgs: teamOrgs })
  deleted += await purgeScope(cutoff(now, retentionDaysFor('pro')), { includeOrgs: proOrgs })
  // enterprise retention is unlimited: never purged.
  return { deleted, artifacts: 0 }
}
