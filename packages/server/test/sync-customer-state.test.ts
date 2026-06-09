import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { syncCustomerState } from '../src/billing/entitlements'
import { db } from '../src/db'
import { subscription } from '../src/db/schemas/index'
import { env } from '../src/lib/env'
import { createUser, resetDb } from './helpers'

const teamProductId = env.POLAR_PRODUCT_TEAM_ID
const proProductId = env.POLAR_PRODUCT_PRO_ID
if (!teamProductId || !proProductId)
  throw new Error('sync-customer-state.test requires POLAR_PRODUCT_* in TEST_ENV')

beforeEach(resetDb)

function row(userId: string) {
  return db.query.subscription.findFirst({ where: eq(subscription.userId, userId) })
}

describe('syncCustomerState', () => {
  it('derives the tier from the active subscription product', async () => {
    const user = await createUser()
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_1',
      subscriptions: [{ productId: teamProductId, status: 'active', currentPeriodEnd: new Date('2030-01-01'), cancelAtPeriodEnd: false }],
    })

    const sub = await row(user.id)
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
      subscriptions: [{ productId: 'unknown-product', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false }],
    })

    expect((await row(user.id))?.tier).toBe('free')
  })

  it('upserts a single row and updates it on the next sync', async () => {
    const user = await createUser()
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_3',
      subscriptions: [{ productId: teamProductId, status: 'trialing', currentPeriodEnd: null, cancelAtPeriodEnd: false }],
    })
    await syncCustomerState({
      userId: user.id,
      polarCustomerId: 'cus_3',
      subscriptions: [{ productId: proProductId, status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: true }],
    })

    const all = await db.select().from(subscription).where(eq(subscription.userId, user.id))
    expect(all).toHaveLength(1)
    expect(all[0]?.tier).toBe('pro')
    expect(all[0]?.status).toBe('active')
    expect(all[0]?.cancelAtPeriodEnd).toBe(true)
  })

  it('ignores a customer state with no external user id', async () => {
    await syncCustomerState({ userId: null, polarCustomerId: 'cus_x', subscriptions: [] })
    expect(await db.select().from(subscription)).toHaveLength(0)
  })
})
