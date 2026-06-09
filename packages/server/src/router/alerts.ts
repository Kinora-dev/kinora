import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sendSlack } from '../alerts/slack'
import { getEntitlements } from '../billing/entitlements'
import { db } from '../db'
import { slackIntegration } from '../db/schemas/index'
import { authProcedure, router } from '../trpc/index'
import { ownedProject } from './dashboard'

const policySchema = z.enum(['always', 'on-failure', 'on-regression'])

async function requireAlerts(userId: string): Promise<void> {
  const entitlements = await getEntitlements(userId)
  if (!entitlements.alerts)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Slack alerts require a paid plan' })
}

export const alertsRouter = router({
  get: authProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId)
      const channel = await db.query.slackIntegration.findFirst({
        where: eq(slackIntegration.projectId, project.id),
      })
      return channel ?? null
    }),

  upsert: authProcedure
    .input(z.object({
      projectId: z.string(),
      webhookUrl: z.string().url(),
      policy: policySchema,
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.user.id)
      const project = await ownedProject(ctx.user.id, input.projectId)
      const values = { webhookUrl: input.webhookUrl, policy: input.policy, enabled: input.enabled }
      await db
        .insert(slackIntegration)
        .values({ projectId: project.id, ...values })
        .onConflictDoUpdate({ target: slackIntegration.projectId, set: values })
      return { ok: true }
    }),

  test: authProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.user.id)
      const project = await ownedProject(ctx.user.id, input.projectId)
      const channel = await db.query.slackIntegration.findFirst({
        where: eq(slackIntegration.projectId, project.id),
      })
      if (!channel)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No Slack channel configured' })

      try {
        await sendSlack(channel.webhookUrl, { text: `kinora · test alert for *${project.name}*. Slack integration works ✅` })
      }
      catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Slack rejected the message. Check the webhook URL.' })
      }
      return { ok: true }
    }),
})
