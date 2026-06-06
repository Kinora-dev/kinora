import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db'
import { env } from './env'
import { getTrustedOrigins } from './utils'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: env.BASE_URL,
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: { enabled: true },
  // No SMTP yet: emails stay unverified, so apply the new address directly instead of mailing a verification link.
  user: { changeEmail: { enabled: true, updateEmailWithoutVerification: true } },
  secret: env.AUTH_SECRET,
  plugins: [apiKey()],
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
