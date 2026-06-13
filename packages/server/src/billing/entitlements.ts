import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { member, subscription, user } from '../db/schemas/index'
import { cloud, env } from '../lib/env'
import { sendMail } from '../lib/mailer'
import { getTrustedOrigins } from '../lib/utils'

export type Tier = 'free' | 'team' | 'pro' | 'enterprise' | 'selfhost'

export interface Entitlements {
  tier: Tier
  maxProjects: number
  retentionDays: number
  includedResults: number
  alerts: boolean
}

const LIMITS: Record<Tier, Omit<Entitlements, 'tier'>> = {
  free: { maxProjects: 1, retentionDays: 7, includedResults: 2_500, alerts: false },
  team: { maxProjects: Number.POSITIVE_INFINITY, retentionDays: 90, includedResults: 10_000, alerts: true },
  pro: { maxProjects: Number.POSITIVE_INFINITY, retentionDays: 365, includedResults: 50_000, alerts: true },
  enterprise: { maxProjects: Number.POSITIVE_INFINITY, retentionDays: Number.POSITIVE_INFINITY, includedResults: Number.POSITIVE_INFINITY, alerts: true },
  selfhost: { maxProjects: Number.POSITIVE_INFINITY, retentionDays: Number.POSITIVE_INFINITY, includedResults: Number.POSITIVE_INFINITY, alerts: true },
}

export function retentionDaysFor(tier: Tier): number {
  return LIMITS[tier].retentionDays
}

function tierForProduct(productId: string | undefined): 'free' | 'team' | 'pro' {
  if (!productId)
    return 'free'
  if (productId === env.POLAR_PRODUCT_TEAM_ID)
    return 'team'
  if (productId === env.POLAR_PRODUCT_PRO_ID)
    return 'pro'
  return 'free'
}

function isActivePaid(tier: Tier, status: string | null | undefined): boolean {
  return tier !== 'free' && (status === 'active' || status === 'trialing')
}

export function becameActivePaid(prev: { tier: Tier, status: string | null } | null | undefined, nextTier: Tier, nextStatus: string | null): boolean {
  return !isActivePaid(prev?.tier ?? 'free', prev?.status) && isActivePaid(nextTier, nextStatus) && (nextTier === 'team' || nextTier === 'pro')
}

export function planActivatedText(name: string | null, tier: 'team' | 'pro', link: string): string {
  const l = LIMITS[tier]
  const label = tier === 'team' ? 'Team' : 'Pro'
  return `Hi${name ? ` ${name}` : ''},\n\nYour kinora ${label} plan is active. You now have:\n\n- ${l.includedResults.toLocaleString('en-US')} test results / month\n- ${l.retentionDays}-day history\n- Unlimited projects\n- Regression alerts (Slack, email, webhook)\n\nOpen your dashboard: ${link}\n\nManage billing anytime under Settings -> Workspace.`
}

// Retention window shrank (downgrade): data past the new window becomes purge-eligible
export function retentionReduced(prevTier: Tier, nextTier: Tier): boolean {
  return retentionDaysFor(prevTier) > retentionDaysFor(nextTier)
}

export function retentionReducedText(name: string | null, tier: 'free' | 'team' | 'pro', link: string): string {
  const days = retentionDaysFor(tier)
  const label = tier === 'team' ? 'Team' : tier === 'pro' ? 'Pro' : 'Free'
  return `Hi${name ? ` ${name}` : ''},\n\nYour kinora workspace is now on the ${label} plan. Test history older than ${days} days will be removed at the next cleanup.\n\nUpgrade again to keep a longer history, or export what you need first: ${link}`
}

interface CustomerStateInput {
  userId: string | null | undefined
  polarCustomerId: string
  subscriptions: Array<{
    productId: string
    status: string
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
  }>
}

export async function syncCustomerState(state: CustomerStateInput): Promise<void> {
  if (!state.userId)
    return

  // Polar customer = the org owner (externalId); the plan applies to the org they own.
  const owner = await db.query.member.findFirst({
    where: and(eq(member.userId, state.userId), eq(member.role, 'owner')),
    columns: { organizationId: true },
  })
  if (!owner)
    return

  const sub = state.subscriptions.find(s => tierForProduct(s.productId) !== 'free')
  const tier = tierForProduct(sub?.productId)

  const values = {
    polarCustomerId: state.polarCustomerId,
    tier,
    status: sub?.status ?? null,
    productId: sub?.productId ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  }

  const prev = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, owner.organizationId),
    columns: { tier: true, status: true },
  })

  await db
    .insert(subscription)
    .values({ organizationId: owner.organizationId, ...values })
    .onConflictDoUpdate({ target: subscription.organizationId, set: values })

  // Welcome and retention-drop are opposite transitions, so at most one fires; one user fetch covers both.
  const welcome = becameActivePaid(prev, tier, values.status) && (tier === 'team' || tier === 'pro')
  const reduced = retentionReduced(prev?.tier ?? 'free', tier)
  if (welcome || reduced) {
    const u = await db.query.user.findFirst({ where: eq(user.id, state.userId), columns: { email: true, name: true } })
    const link = getTrustedOrigins()[0] ?? ''
    if (u && welcome) {
      sendMail({
        to: u.email,
        subject: `Your kinora ${tier === 'team' ? 'Team' : 'Pro'} plan is active`,
        text: planActivatedText(u.name, tier, link),
      })
    }
    else if (u && reduced) {
      sendMail({
        to: u.email,
        subject: 'Your kinora history retention was reduced',
        text: retentionReducedText(u.name, tier, link),
      })
    }
  }
}

export interface SubscriptionState {
  status: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

export async function getSubscription(organizationId: string): Promise<SubscriptionState | null> {
  if (!cloud)
    return null

  const row = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
    columns: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  })
  return row ?? null
}

export async function getEntitlements(organizationId: string): Promise<Entitlements> {
  if (!cloud)
    return { tier: 'selfhost', ...LIMITS.selfhost }

  const row = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
    columns: { tier: true },
  })
  const tier = row?.tier ?? 'free'
  return { tier, ...LIMITS[tier] }
}

// The single ingest that crosses a usage threshold. Usage is monotonic within a month and resets
// monthly, so before/after the insert is enough to fire once per threshold - no persisted "warned" flag.
export function quotaCrossing(before: number, after: number, limit: number): 'reached' | 'near' | null {
  if (before < limit && after >= limit)
    return 'reached'
  const near = Math.floor(limit * 0.8)
  if (before < near && after >= near)
    return 'near'
  return null
}

export function quotaWarningText(name: string | null, kind: 'reached' | 'near', used: number, limit: number, link: string): string {
  const greeting = `Hi${name ? ` ${name}` : ''},`
  const l = limit.toLocaleString('en-US')
  if (kind === 'reached')
    return `${greeting}\n\nYour kinora workspace hit its monthly free limit of ${l} test results. New results are rejected until the monthly reset.\n\nUpgrade to keep ingesting: ${link}`
  return `${greeting}\n\nYour kinora workspace has used ${used.toLocaleString('en-US')} of its ${l} monthly free test results. Upgrade to avoid hitting the cap and dropping results: ${link}`
}

export interface IngestCap {
  error: string
  limit: number
}

// Plan caps enforced at ingest. Pure: caller supplies the current counts. Returns the 402
// payload to reject with, or null to allow.
export function ingestCapError(e: Entitlements, usedResults: number, isNewProject: boolean, projectCount: number): IngestCap | null {
  if (e.tier === 'free' && usedResults >= e.includedResults)
    return { error: 'Free plan monthly test-result limit reached. Upgrade to keep ingesting.', limit: e.includedResults }

  if (isNewProject && Number.isFinite(e.maxProjects) && projectCount >= e.maxProjects)
    return { error: 'Plan project limit reached. Upgrade to add more projects.', limit: e.maxProjects }

  return null
}
