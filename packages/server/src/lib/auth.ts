import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { lastLoginMethod } from 'better-auth/plugins'
import { polarAuthPlugin } from '../billing/polar'
import { db } from '../db'
import { env } from './env'
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
  // Prod: share the session cookie across app.kinora.dev <-> api.kinora.dev
  advanced: {
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === 'production',
      domain: '.kinora.dev',
    },
  },
  secret: env.AUTH_SECRET,
  plugins: [apiKey(), lastLoginMethod(), polarAuthPlugin()].filter(
    (plugin): plugin is NonNullable<typeof plugin> => plugin !== null,
  ),
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
