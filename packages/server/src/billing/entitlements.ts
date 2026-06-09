import { eq } from 'drizzle-orm'
import { db } from '../db'
import { subscription } from '../db/schemas/index'
import { cloud, env } from '../lib/env'

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

function tierForProduct(productId: string | undefined): 'free' | 'team' | 'pro' {
  if (!productId)
    return 'free'
  if (productId === env.POLAR_PRODUCT_TEAM_ID)
    return 'team'
  if (productId === env.POLAR_PRODUCT_PRO_ID)
    return 'pro'
  return 'free'
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

  await db
    .insert(subscription)
    .values({ userId: state.userId, ...values })
    .onConflictDoUpdate({ target: subscription.userId, set: values })
}

export interface SubscriptionState {
  status: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

export async function getSubscription(userId: string): Promise<SubscriptionState | null> {
  if (!cloud)
    return null

  const row = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
    columns: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  })
  return row ?? null
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  if (!cloud)
    return { tier: 'selfhost', ...LIMITS.selfhost }

  const row = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
    columns: { tier: true },
  })
  const tier = row?.tier ?? 'free'
  return { tier, ...LIMITS[tier] }
}
