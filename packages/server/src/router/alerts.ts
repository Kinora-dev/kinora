import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sendSlack } from '../alerts/slack'
import { getEntitlements } from '../billing/entitlements'
import { db } from '../db'
import { slackIntegration } from '../db/schemas/index'
import { slackApp } from '../lib/env'
import { orgProcedure, router } from '../trpc/index'
import { ownedProject } from './dashboard'

const policySchema = z.enum(['always', 'on-failure', 'on-regression'])

async function requireAlerts(organizationId: string): Promise<void> {
  const entitlements = await getEntitlements(organizationId)
  if (!entitlements.alerts)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Slack alerts require a paid plan' })
}

export const alertsRouter = router({
  // True when the server has a Slack OAuth app: front shows "Add to Slack" vs manual paste.
  oauthEnabled: orgProcedure.query(() => ({ enabled: slackApp !== null })),

  get: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.organizationId, input.projectId)
      const channel = await db.query.slackIntegration.findFirst({
        where: eq(slackIntegration.projectId, project.id),
      })
      return channel ?? null
    }),

  upsert: orgProcedure
    .input(z.object({
      projectId: z.string(),
      webhookUrl: z.string().url(),
      policy: policySchema,
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.organizationId)
      const project = await ownedProject(ctx.organizationId, input.projectId)
      const values = { webhookUrl: input.webhookUrl, policy: input.policy, enabled: input.enabled }
      await db
        .insert(slackIntegration)
        .values({ projectId: project.id, ...values })
        .onConflictDoUpdate({ target: slackIntegration.projectId, set: values })
      return { ok: true }
    }),

  // OAuth path: webhook comes from the install flow, so only policy/enabled are edited here.
  updateSettings: orgProcedure
    .input(z.object({
      projectId: z.string(),
      policy: policySchema,
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.organizationId)
      const project = await ownedProject(ctx.organizationId, input.projectId)
      const updated = await db
        .update(slackIntegration)
        .set({ policy: input.policy, enabled: input.enabled })
        .where(eq(slackIntegration.projectId, project.id))
        .returning({ projectId: slackIntegration.projectId })
      if (!updated.length)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No Slack integration to update' })
      return { ok: true }
    }),

  disconnect: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.organizationId, input.projectId)
      await db.delete(slackIntegration).where(eq(slackIntegration.projectId, project.id))
      return { ok: true }
    }),

  test: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.organizationId)
      const project = await ownedProject(ctx.organizationId, input.projectId)
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
