import { apiKey } from '@better-auth/api-key'
import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { lastLoginMethod } from 'better-auth/plugins'
import { syncCustomerState } from '../billing/entitlements'
import { polarClient } from '../billing/polar'
import { db } from '../db'
import { env } from './env'
import { logger } from './logger'
import { getTrustedOrigins } from './utils'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: env.BASE_URL,
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  // No SMTP yet: emails stay unverified, so apply the new address directly instead of mailing a verification link.
  user: { changeEmail: { enabled: true, updateEmailWithoutVerification: true } },
  secret: env.AUTH_SECRET,
  plugins: [
    apiKey(),
    lastLoginMethod(),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: env.POLAR_PRODUCT_TEAM_ID, slug: 'team' },
            { productId: env.POLAR_PRODUCT_PRO_ID, slug: 'pro' },
          ],
          successUrl: '/billing/success?checkout_id={CHECKOUT_ID}',
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
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
    }),
  ],
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
