import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { cloud, env } from '../lib/env'
import { logger } from '../lib/logger'
import { syncCustomerState } from './entitlements'

export const polarClient = cloud
  ? new Polar({
      accessToken: cloud.accessToken,
      server: env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    })
  : null

export function polarAuthPlugin() {
  if (!cloud || !polarClient)
    return null

  return polar({
    client: polarClient,
    createCustomerOnSignUp: true,
    use: [
      checkout({
        products: [
          { productId: cloud.teamProductId, slug: 'team' },
          { productId: cloud.proProductId, slug: 'pro' },
        ],
        successUrl: '/billing/success?checkout_id={CHECKOUT_ID}',
        authenticatedUsersOnly: true,
      }),
      portal(),
      usage(),
      webhooks({
        secret: cloud.webhookSecret,
        onCustomerStateChanged: async ({ data }) => {
          await syncCustomerState({
            userId: data.externalId,
            polarCustomerId: data.id,
            subscriptions: data.activeSubscriptions.map(s => ({
              productId: s.productId,
              status: s.status,
              currentPeriodEnd: s.currentPeriodEnd,
              cancelAtPeriodEnd: s.cancelAtPeriodEnd,
            })),
          })
        },
        onPayload: async (payload) => {
          logger.info({ event: payload.type }, 'polar webhook')
        },
      }),
    ],
  })
}
