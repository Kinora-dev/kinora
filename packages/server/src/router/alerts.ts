import type { AlertPayload } from '../alerts/core'
import { randomUUID } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { buildAlertEmail } from '../alerts/email'
import { sendSlack } from '../alerts/slack'
import { postWebhook } from '../alerts/webhook'
import { getEntitlements } from '../billing/entitlements'
import { db } from '../db'
import { alertChannel, project, slackIntegration } from '../db/schemas/index'
import { env } from '../lib/env'
import { sendMail } from '../lib/mailer'
import { adminProcedure, orgProcedure, router } from '../trpc/index'
import { ownedProject } from './dashboard'

const policySchema = z.enum(['always', 'on-failure', 'on-regression'])
const kindSchema = z.enum(['email', 'webhook'])

function validateTarget(kind: 'email' | 'webhook', target: string): void {
  const schema = kind === 'email' ? z.email() : z.url({ protocol: /^https$/ })
  if (!schema.safeParse(target).success)
    throw new TRPCError({ code: 'BAD_REQUEST', message: kind === 'email' ? 'Invalid email address' : 'Webhook URL must be HTTPS' })
}

// Resolve a channel + its project, asserting the caller owns it. channel.projectId is the
// project uuid (not the slug ownedProject expects), so verify ownership by id here.
async function ownedChannel(organizationId: string, id: string) {
  const channel = await db.query.alertChannel.findFirst({ where: eq(alertChannel.id, id) })
  if (!channel)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' })
  const proj = await db.query.project.findFirst({
    where: and(eq(project.id, channel.projectId), eq(project.organizationId, organizationId)),
  })
  if (!proj)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' })
  return { channel, project: proj }
}

async function deliver(channel: typeof alertChannel.$inferSelect, payload: AlertPayload): Promise<void> {
  if (channel.kind === 'email')
    sendMail({ to: channel.target, ...buildAlertEmail(payload) })
  else
    await postWebhook(channel.target, payload)
}

function sampleAlert(projectName: string, slug: string): AlertPayload {
  return {
    projectName,
    runUrl: `${env.WEB_ORIGIN}/projects/${slug}`,
    counts: { total: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    newlyFailing: [],
    newlyFlaky: [],
  }
}

async function requireAlerts(organizationId: string): Promise<void> {
  const entitlements = await getEntitlements(organizationId)
  if (!entitlements.alerts)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Alerts require a paid plan' })
}

export const alertsRouter = router({
  get: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.organizationId, input.projectId)
      const channel = await db.query.slackIntegration.findFirst({
        where: eq(slackIntegration.projectId, project.id),
      })
      return channel ?? null
    }),

  upsert: adminProcedure
    .input(z.object({
      projectId: z.string(),
      webhookUrl: z.url({ protocol: /^https$/ }).refine(
        u => new URL(u).hostname === 'hooks.slack.com',
        'Must be a Slack webhook URL (hooks.slack.com)',
      ),
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
  updateSettings: adminProcedure
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

  disconnect: adminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.organizationId, input.projectId)
      await db.delete(slackIntegration).where(eq(slackIntegration.projectId, project.id))
      return { ok: true }
    }),

  test: adminProcedure
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

  // --- Email / webhook channels (Slack is handled by the procedures above) ---
  channels: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.organizationId, input.projectId)
      return db.select().from(alertChannel).where(eq(alertChannel.projectId, project.id))
    }),

  addChannel: adminProcedure
    .input(z.object({ projectId: z.string(), kind: kindSchema, target: z.string().trim().min(1), policy: policySchema }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.organizationId)
      const project = await ownedProject(ctx.organizationId, input.projectId)
      validateTarget(input.kind, input.target)
      await db.insert(alertChannel).values({
        id: randomUUID(),
        projectId: project.id,
        kind: input.kind,
        target: input.target,
        policy: input.policy,
        enabled: true,
      })
      return { ok: true }
    }),

  updateChannel: adminProcedure
    .input(z.object({ id: z.string(), policy: policySchema, enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.organizationId)
      await ownedChannel(ctx.organizationId, input.id)
      await db.update(alertChannel).set({ policy: input.policy, enabled: input.enabled }).where(eq(alertChannel.id, input.id))
      return { ok: true }
    }),

  removeChannel: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ownedChannel(ctx.organizationId, input.id)
      await db.delete(alertChannel).where(eq(alertChannel.id, input.id))
      return { ok: true }
    }),

  testChannel: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAlerts(ctx.organizationId)
      const { channel, project: proj } = await ownedChannel(ctx.organizationId, input.id)
      try {
        await deliver(channel, sampleAlert(proj.name, proj.slug))
      }
      catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Delivery failed. Check the target.' })
      }
      return { ok: true }
    }),
})
