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

const INGEST_MAX_RETRIES = 3

function retryAfterMs(error: unknown, attempt: number): number {
  const headers = (error as { headers?: unknown }).headers
  const raw = headers instanceof Headers ? headers.get('retry-after') : (headers as Record<string, string> | undefined)?.['retry-after']
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 4000) : 2 ** attempt * 500
}

// Bulk imports of current-period runs can burst past Polar's rate limit; retry 429s
// (honoring Retry-After) so billable usage isn't silently dropped. Best-effort: gives up
// after a few tries rather than stalling ingest. Normal per-run traffic never retries.
export async function meterTestResults(externalCustomerId: string, results: number): Promise<void> {
  if (!polarClient)
    return
  for (let attempt = 0; ; attempt++) {
    try {
      await polarClient.events.ingest({ events: [{ name: 'test_results', externalCustomerId, metadata: { results } }] })
      return
    }
    catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 429 || attempt >= INGEST_MAX_RETRIES)
        throw error
      await new Promise(resolve => setTimeout(resolve, retryAfterMs(error, attempt)))
    }
  }
}

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
        successUrl: `${env.WEB_ORIGIN}/settings/workspace?checkout=success`,
        authenticatedUsersOnly: true,
      }),
      portal(),
      usage(),
      webhooks({
        secret: cloud.webhookSecret,
        onCustomerStateChanged: async ({ data, timestamp }) => {
          await syncCustomerState({
            userId: data.externalId,
            polarCustomerId: data.id,
            eventAt: timestamp,
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
