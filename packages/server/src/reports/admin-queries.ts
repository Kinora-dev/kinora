import type { AnyColumn } from 'drizzle-orm'
import { and, count, desc, eq, gte, inArray, max, notInArray, sql } from 'drizzle-orm'
import { isActivePaid } from '../billing/entitlements'
import { db } from '../db'
import { member, organization, project, run, subscription, test, user } from '../db/schemas/index'

// Cross-org operator analytics: unscoped, read-everything. Only ever reached via
// platformAdminProcedure - never import this from a user-facing router.
// Dogfood/test orgs flagged organization.internal are excluded from every metric.

const DAY = 86_400_000

export interface AdminOverview {
  users: number
  accounts: number
  activeAccounts: number
  projects: number
  testResults30d: number
  newUsers7d: number
}

export interface Bucket {
  date: string
  count: number
}

export interface AccountRow {
  orgId: string
  name: string
  ownerEmail: string | null
  members: number
  plan: string
  projects: number
  lastRunAt: string | null
}

// Internal orgs and the users who own them, excluded from real-adoption metrics.
async function internalIds(): Promise<{ orgIds: string[], userIds: string[] }> {
  const orgs = await db.select({ id: organization.id }).from(organization).where(eq(organization.internal, true))
  const orgIds = orgs.map(o => o.id)
  if (!orgIds.length)
    return { orgIds: [], userIds: [] }
  const owners = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(inArray(member.organizationId, orgIds), eq(member.role, 'owner')))
  return { orgIds, userIds: owners.map(o => o.userId) }
}

export async function adminOverview(): Promise<AdminOverview> {
  const since30 = new Date(Date.now() - 30 * DAY)
  const since7 = new Date(Date.now() - 7 * DAY)
  const { orgIds, userIds } = await internalIds()
  const orgNot = (col: AnyColumn) => (orgIds.length ? notInArray(col, orgIds) : undefined)
  const userNot = userIds.length ? notInArray(user.id, userIds) : undefined

  const [[users], [accounts], [projects], [newUsers7d], [testResults30d], [activeAccounts]] = await Promise.all([
    db.select({ n: count() }).from(user).where(userNot),
    db.select({ n: count() }).from(organization).where(orgNot(organization.id)),
    db.select({ n: count() }).from(project).where(orgNot(project.organizationId)),
    db.select({ n: count() }).from(user).where(and(gte(user.createdAt, since7), userNot)),
    db
      .select({ n: count() })
      .from(test)
      .innerJoin(project, eq(test.projectId, project.id))
      .where(and(gte(test.createdAt, since30), orgNot(project.organizationId))),
    db
      .select({ n: sql<number>`count(distinct ${project.organizationId})::int` })
      .from(run)
      .innerJoin(project, eq(run.projectId, project.id))
      .where(and(gte(run.startedAt, since30), orgNot(project.organizationId))),
  ])

  return {
    users: users.n,
    accounts: accounts.n,
    projects: projects.n,
    newUsers7d: newUsers7d.n,
    testResults30d: testResults30d.n,
    activeAccounts: activeAccounts.n,
  }
}

export async function signupsPerWeek(weeks = 12): Promise<Bucket[]> {
  const since = new Date(Date.now() - weeks * 7 * DAY)
  const { userIds } = await internalIds()
  const bucket = sql`date_trunc('week', ${user.createdAt})`
  return db
    .select({ date: sql<string>`to_char(${bucket}, 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` })
    .from(user)
    .where(and(gte(user.createdAt, since), userIds.length ? notInArray(user.id, userIds) : undefined))
    .groupBy(bucket)
    .orderBy(bucket)
}

export async function runsPerDay(days = 30): Promise<Bucket[]> {
  const since = new Date(Date.now() - days * DAY)
  const { orgIds } = await internalIds()
  const bucket = sql`date_trunc('day', ${run.startedAt})`
  return db
    .select({ date: sql<string>`to_char(${bucket}, 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` })
    .from(run)
    .innerJoin(project, eq(run.projectId, project.id))
    .where(and(gte(run.startedAt, since), orgIds.length ? notInArray(project.organizationId, orgIds) : undefined))
    .groupBy(bucket)
    .orderBy(bucket)
}

export async function listAccounts(): Promise<AccountRow[]> {
  const [orgs, owners, memberCounts, projectCounts, lastRuns, subs] = await Promise.all([
    db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.internal, false)),
    db
      .select({ orgId: member.organizationId, email: user.email })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.role, 'owner'))
      // Newest first so the Map's last-write keeps the founding owner for multi-owner orgs.
      .orderBy(desc(member.createdAt)),
    db.select({ orgId: member.organizationId, n: count() }).from(member).groupBy(member.organizationId),
    db.select({ orgId: project.organizationId, n: count() }).from(project).groupBy(project.organizationId),
    db
      .select({ orgId: project.organizationId, last: max(run.startedAt) })
      .from(run)
      .innerJoin(project, eq(run.projectId, project.id))
      .groupBy(project.organizationId),
    db.select({ orgId: subscription.organizationId, tier: subscription.tier, status: subscription.status }).from(subscription),
  ])

  const ownerByOrg = new Map(owners.map(o => [o.orgId, o.email]))
  const membersByOrg = new Map(memberCounts.map(m => [m.orgId, m.n]))
  const projectsByOrg = new Map(projectCounts.map(p => [p.orgId, p.n]))
  const lastByOrg = new Map(lastRuns.map(r => [r.orgId, r.last]))
  // Only an active paid subscription counts as its tier; canceled/past-due collapses to free.
  const planByOrg = new Map(subs.map(s => [s.orgId, isActivePaid(s.tier, s.status) ? s.tier : 'free']))

  return orgs
    .map((o) => {
      const last = lastByOrg.get(o.id)
      return {
        orgId: o.id,
        name: o.name,
        ownerEmail: ownerByOrg.get(o.id) ?? null,
        members: membersByOrg.get(o.id) ?? 0,
        plan: planByOrg.get(o.id) ?? 'free',
        projects: projectsByOrg.get(o.id) ?? 0,
        lastRunAt: last ? last.toISOString() : null,
      }
    })
    .sort((a, b) => {
      if (a.lastRunAt === b.lastRunAt)
        return 0
      if (a.lastRunAt === null)
        return 1
      if (b.lastRunAt === null)
        return -1
      return a.lastRunAt < b.lastRunAt ? 1 : -1
    })
}
