import { randomUUID } from 'node:crypto'
import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer, lastLoginMethod, organization } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import { polarAuthPlugin, polarClient } from '../billing/polar'
import { db } from '../db'
import { member, organization as organizationTable } from '../db/schemas/index'
import { purgeUserOwnedData } from './account'
import { env } from './env'
import { logger } from './logger'
import { mailerEnabled, sendMail } from './mailer'
import { getTrustedOrigins } from './utils'

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'team'
}

const polarPlugin = polarAuthPlugin()

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  baseURL: env.BASE_URL,
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      sendMail({
        to: user.email,
        subject: 'Reset your kinora password',
        text: `Hi${user.name ? ` ${user.name}` : ''},\n\nSomeone requested a password reset for your kinora account. Click the link below to choose a new password:\n\n${url}\n\nThe link expires in 1 hour. If you didn't ask for this, you can safely ignore this email.`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: mailerEnabled,
    sendVerificationEmail: async ({ user, url }) => {
      sendMail({
        to: user.email,
        subject: 'Verify your kinora email',
        text: `Hi${user.name ? ` ${user.name}` : ''},\n\nConfirm this address for your kinora account by clicking the link below:\n\n${url}\n\nIf you didn't create a kinora account, you can safely ignore this email.`,
      })
    },
  },
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
  user: {
    deleteUser: {
      enabled: true,
      // Fresh session or password required by better-auth; we just clean up owned data first.
      beforeDelete: async (u) => {
        await purgeUserOwnedData(u.id)
        if (polarClient) {
          try {
            await polarClient.customers.deleteExternal({ externalId: u.id })
          }
          catch (error) {
            logger.warn({ error, userId: u.id }, 'polar customer deletion skipped')
          }
        }
      },
    },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: !mailerEnabled,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        sendMail({
          to: user.email,
          subject: 'Approve your kinora email change',
          text: `Hi${user.name ? ` ${user.name}` : ''},\n\nApprove changing your kinora email to ${newEmail} by clicking the link below:\n\n${url}\n\nIf you didn't request this, ignore this email and your address stays the same.`,
        })
      },
    },
  },
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
  // Share the session cookie across subdomains (cloud: app. <-> api.). Self-host single-origin leaves it unset.
  advanced: env.COOKIE_DOMAIN
    ? { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } }
    : {},
  secret: env.AUTH_SECRET,
  plugins: [
    // Plugin default is 10 req/day per key, which any real CI exceeds, billing quotas already cap ingest volume.
    apiKey({ rateLimit: { enabled: false } }),
    // Lets non-browser clients (desktop app) send the session token as `Authorization: Bearer`
    // instead of a cookie; getSession then resolves it from the header.
    bearer(),
    lastLoginMethod(),
    organization({
      // Only the auto-created personal org exists; members can't spin up extra orgs.
      allowUserToCreateOrganization: false,
      sendInvitationEmail: async (data) => {
        // The UI also surfaces the accept link from the invite response, so no-SMTP setups still work.
        logger.info({ invitationId: data.id, email: data.email, org: data.organization.name }, 'org invitation created')
        const inviter = data.inviter.user.name || data.inviter.user.email
        sendMail({
          to: data.email,
          subject: `Join ${data.organization.name} on kinora`,
          text: `${inviter} invited you to the "${data.organization.name}" workspace on kinora.\n\nAccept the invitation:\n\n${env.WEB_ORIGIN}/accept-invite/${data.id}\n\nIf you weren't expecting this, you can safely ignore this email.`,
        })
      },
    }),
    ...(polarPlugin ? [polarPlugin] : []),
  ],
})

export interface AuthType {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}
