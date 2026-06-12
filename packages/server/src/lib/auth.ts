import { randomUUID } from 'node:crypto'
import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { lastLoginMethod, organization } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import { polarAuthPlugin, polarClient } from '../billing/polar'
import { db } from '../db'
import { member, organization as organizationTable } from '../db/schemas/index'
import { env } from './env'
import { logger } from './logger'
import { getTrustedOrigins } from './utils'

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'team'
}

const polarPlugin = polarAuthPlugin()

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
  databaseHooks: {
    user: {
      create: {
        // Every account owns one personal organization; projects + billing live on it.
        after: async (createdUser) => {
          const orgId = randomUUID()
          const base = slugify(createdUser.name || createdUser.email.split('@')[0] || 'team')
          await db.insert(organizationTable).values({
            id: orgId,
            name: createdUser.name ? `${createdUser.name}'s workspace` : 'My workspace',
            slug: `${base}-${randomUUID().slice(0, 8)}`,
          })
          await db.insert(member).values({
            id: randomUUID(),
            organizationId: orgId,
            userId: createdUser.id,
            role: 'owner',
          })

          if (polarClient) {
            try {
              await polarClient.customers.create({ email: createdUser.email, name: createdUser.name, externalId: createdUser.id })
            }
            catch (error) {
              logger.warn({ error, userId: createdUser.id }, 'polar customer creation skipped')
            }
          }
        },
      },
    },
    session: {
      create: {
        // Default the session to the org the user owns (a user may also be a member of others).
        before: async (session) => {
          const owned = await db.query.member.findFirst({
            where: and(eq(member.userId, session.userId), eq(member.role, 'owner')),
            columns: { organizationId: true },
          })
          return { data: { ...session, activeOrganizationId: owned?.organizationId ?? null } }
        },
      },
    },
  },
  // Prod: share the session cookie across app.kinora.dev <-> api.kinora.dev
  advanced: {
    crossSubDomainCookies: {
      enabled: env.NODE_ENV === 'production',
      domain: '.kinora.dev',
    },
  },
  secret: env.AUTH_SECRET,
  plugins: [
    apiKey(),
    lastLoginMethod(),
    organization({
      // Only the auto-created personal org exists; members can't spin up extra orgs.
      allowUserToCreateOrganization: false,
      sendInvitationEmail: async (data) => {
        // No SMTP yet: the UI surfaces the accept link from the invite response; log it as a fallback.
        logger.info({ invitationId: data.id, email: data.email, org: data.organization.name }, 'org invitation created')
      },
    }),
    ...(polarPlugin ? [polarPlugin] : []),
  ],
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
