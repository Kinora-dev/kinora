import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { cloud, env } from '../lib/env'
import { logger } from '../lib/logger'
import { getTrustedOrigins } from '../lib/utils'
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
    // We create the customer ourselves in the signup hook (non-fatal) so a Polar
    // hiccup never blocks sign-up; the plugin's own create is fatal on failure.
    createCustomerOnSignUp: false,
    use: [
      checkout({
        products: [
          { productId: cloud.teamProductId, slug: 'team' },
          { productId: cloud.proProductId, slug: 'pro' },
        ],
        successUrl: `${getTrustedOrigins()[0] ?? ''}/settings/workspace?checkout=success`,
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
