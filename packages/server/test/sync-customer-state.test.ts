import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { becameActivePaid, planActivatedText, retentionReduced, retentionReducedText, syncCustomerState } from '../src/billing/entitlements'
import { db } from '../src/db'
import { subscription } from '../src/db/schemas/index'
import { env } from '../src/lib/env'
import { createUser, ownedOrgId, resetDb } from './helpers'

const teamProductId = env.POLAR_PRODUCT_TEAM_ID
const proProductId = env.POLAR_PRODUCT_PRO_ID
if (!teamProductId || !proProductId)
  throw new Error('sync-customer-state.test requires POLAR_PRODUCT_* in TEST_ENV')

beforeEach(resetDb)

function row(organizationId: string) {
  return db.query.subscription.findFirst({ where: eq(subscription.organizationId, organizationId) })
}

describe('syncCustomerState', () => {
  it('derives the tier from the active subscription product', async () => {
    const user = await createUser()
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_1',
      eventAt: new Date('2026-01-01T00:00:00Z'),
      subscriptions: [{ productId: teamProductId, status: 'active', currentPeriodEnd: new Date('2030-01-01'), cancelAtPeriodEnd: false }],
    })

    const sub = await row(await ownedOrgId(user.id))
    expect(sub?.tier).toBe('team')
    expect(sub?.status).toBe('active')
    expect(sub?.polarCustomerId).toBe('cus_1')
    expect(sub?.cancelAtPeriodEnd).toBe(false)
  })

  it('falls back to free when no subscription matches a known product', async () => {
    const user = await createUser()
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_2',
      eventAt: new Date('2026-01-01T00:00:00Z'),
      subscriptions: [{ productId: 'unknown-product', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false }],
    })

    expect((await row(await ownedOrgId(user.id)))?.tier).toBe('free')
  })

  it('upserts a single row and updates it on the next sync', async () => {
    const user = await createUser()
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_3',
      eventAt: new Date('2026-01-01T00:00:00Z'),
      subscriptions: [{ productId: teamProductId, status: 'trialing', currentPeriodEnd: null, cancelAtPeriodEnd: false }],
    })
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_3',
      eventAt: new Date('2026-01-02T00:00:00Z'),
      subscriptions: [{ productId: proProductId, status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: true }],
    })

    const all = await db.select().from(subscription).where(eq(subscription.organizationId, await ownedOrgId(user.id)))
    expect(all).toHaveLength(1)
    expect(all[0]?.tier).toBe('pro')
    expect(all[0]?.status).toBe('active')
    expect(all[0]?.cancelAtPeriodEnd).toBe(true)
  })

  it('ignores a customer state with no external user id', async () => {
    await syncCustomerState({ userId: null, polarCustomerId: 'cus_x', eventAt: new Date('2026-01-01T00:00:00Z'), subscriptions: [] })
    expect(await db.select().from(subscription)).toHaveLength(0)
  })

  it('ignores an out-of-order event older than the applied state', async () => {
    const user = await createUser()
    // Active pro lands first (later event), then a stale empty-state webhook arrives out of order.
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_4',
      eventAt: new Date('2026-01-02T00:00:00Z'),
      subscriptions: [{ productId: proProductId, status: 'active', currentPeriodEnd: new Date('2030-01-01'), cancelAtPeriodEnd: false }],
    })
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_4',
      eventAt: new Date('2026-01-01T00:00:00Z'),
      subscriptions: [],
    })

    const sub = await row(await ownedOrgId(user.id))
    expect(sub?.tier).toBe('pro')
    expect(sub?.status).toBe('active')
  })
})

describe('becameActivePaid (welcome-email trigger)', () => {
  it('fires on the jump from no/free plan to an active paid plan', () => {
    expect(becameActivePaid(null, 'team', 'active')).toBe(true)
    expect(becameActivePaid({ tier: 'free', status: null }, 'pro', 'active')).toBe(true)
    expect(becameActivePaid({ tier: 'free', status: null }, 'team', 'trialing')).toBe(true)
  })

  it('does not fire when already on an active paid plan', () => {
    expect(becameActivePaid({ tier: 'team', status: 'active' }, 'team', 'active')).toBe(false)
    expect(becameActivePaid({ tier: 'team', status: 'active' }, 'pro', 'active')).toBe(false)
  })

  it('does not fire for free or non-active statuses', () => {
    expect(becameActivePaid(null, 'free', null)).toBe(false)
    expect(becameActivePaid(null, 'team', 'incomplete')).toBe(false)
    expect(becameActivePaid(null, 'team', 'past_due')).toBe(false)
  })
})

describe('planActivatedText', () => {
  it('names the tier and lists its entitlements', () => {
    const text = planActivatedText('Joris', 'team', 'https://app.kinora.dev')
    expect(text).toContain('Team plan is active')
    expect(text).toContain('10,000 test results')
    expect(text).toContain('90-day history')
    expect(text).toContain('https://app.kinora.dev')
  })

  it('omits the name when absent', () => {
    expect(planActivatedText(null, 'pro', 'x')).toContain('Hi,')
  })
})

describe('retentionReduced (downgrade-warning trigger)', () => {
  it('fires when the retention window shrinks', () => {
    expect(retentionReduced('pro', 'free')).toBe(true)
    expect(retentionReduced('pro', 'team')).toBe(true)
    expect(retentionReduced('team', 'free')).toBe(true)
  })

  it('does not fire on upgrade or same tier', () => {
    expect(retentionReduced('free', 'team')).toBe(false)
    expect(retentionReduced('team', 'pro')).toBe(false)
    expect(retentionReduced('team', 'team')).toBe(false)
    expect(retentionReduced('free', 'free')).toBe(false)
  })
})

describe('retentionReducedText', () => {
  it('states the new plan and its window', () => {
    const text = retentionReducedText('Joris', 'free', 'https://app.kinora.dev')
    expect(text).toContain('Free plan')
    expect(text).toContain('older than 7 days')
    expect(text).toContain('https://app.kinora.dev')
  })

  it('omits the name when absent', () => {
    expect(retentionReducedText(null, 'team', 'x')).toContain('Hi,')
  })
})
