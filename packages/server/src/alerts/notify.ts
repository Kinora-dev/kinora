import type { Counts, NormTest } from '@kinora/core'
import type { AlertPayload, AlertPolicy } from './core'
import { compareRuns } from '@kinora/core'
import { eq } from 'drizzle-orm'
import { getEntitlements } from '../billing/entitlements'
import { db } from '../db'
import { alertChannel, project, slackIntegration } from '../db/schemas/index'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { sendMail } from '../lib/mailer'
import { previousRunTests } from '../reports/regression'
import { shouldFire } from './core'
import { buildAlertEmail } from './email'
import { buildSlackMessage, sendSlack } from './slack'
import { postWebhook } from './webhook'

export interface NotifyRunInput {
  organizationId: string
  projectId: string
  runId: string
  startedAt: Date
  branch?: string
  counts: Counts
  tests: NormTest[]
}

export async function notifyRun(input: NotifyRunInput): Promise<void> {
  // Alerts are a paid feature (self-host is unlimited).
  const entitlements = await getEntitlements(input.organizationId)
  if (!entitlements.alerts)
    return

  const slack = await db.query.slackIntegration.findFirst({
    where: eq(slackIntegration.projectId, input.projectId),
  })
  const channels = await db.select().from(alertChannel).where(eq(alertChannel.projectId, input.projectId))
  const activeSlack = slack?.enabled ? slack : null
  const activeChannels = channels.filter(c => c.enabled)
  // Skip the regression query when nothing is wired up.
  if (!activeSlack && activeChannels.length === 0)
    return

  const prevTests = await previousRunTests(input.projectId, input.startedAt, input.branch)
  const deltas = compareRuns(prevTests, input.tests)
  const newlyFailing = deltas.filter(d => d.change === 'broken')
  const newlyFlaky = deltas.filter(d => d.change === 'newly-flaky')

  const projectRow = await db.query.project.findFirst({
    where: eq(project.id, input.projectId),
    columns: { name: true, slug: true },
  })
  const slug = projectRow?.slug ?? input.projectId
  const payload: AlertPayload = {
    projectName: projectRow?.name ?? 'project',
    runUrl: `${env.WEB_ORIGIN}/projects/${slug}/runs/${input.runId}`,
    counts: input.counts,
    newlyFailing: newlyFailing.map(d => d.title),
    newlyFlaky: newlyFlaky.map(d => d.title),
  }
  const fires = (policy: AlertPolicy): boolean =>
    shouldFire(policy, payload.counts, payload.newlyFailing.length, payload.newlyFlaky.length)

  if (activeSlack && fires(activeSlack.policy)) {
    try {
      await sendSlack(activeSlack.webhookUrl, buildSlackMessage(payload))
    }
    catch (error) {
      logger.error({ error, projectId: input.projectId }, 'slack alert failed')
    }
  }

  for (const ch of activeChannels) {
    if (!fires(ch.policy))
      continue
    try {
      if (ch.kind === 'email')
        sendMail({ to: ch.target, ...buildAlertEmail(payload) })
      else
        await postWebhook(ch.target, payload)
    }
    catch (error) {
      logger.error({ error, projectId: input.projectId, kind: ch.kind }, 'alert delivery failed')
    }
  }
}
