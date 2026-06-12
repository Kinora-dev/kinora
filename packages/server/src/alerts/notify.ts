import type { Counts, NormTest } from '@kinora/core'
import { compareRuns } from '@kinora/core'
import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { getEntitlements } from '../billing/entitlements'
import { db } from '../db'
import { project, run, slackIntegration, test } from '../db/schemas/index'
import { logger } from '../lib/logger'
import { getTrustedOrigins } from '../lib/utils'
import { buildSlackMessage, sendSlack } from './slack'

type TestRow = typeof test.$inferSelect

export interface NotifyRunInput {
  organizationId: string
  projectId: string
  runId: string
  startedAt: Date
  branch?: string
  counts: Counts
  tests: NormTest[]
}

function rowToNormTest(t: TestRow): NormTest {
  return {
    testKey: t.testKey,
    title: t.title,
    titlePath: t.titlePath,
    file: t.file,
    line: t.line,
    column: t.column,
    projectName: t.projectName,
    status: t.status as NormTest['status'],
    ok: t.ok,
    duration: t.duration,
    retries: t.retries,
    tags: t.tags,
    annotations: t.annotations,
    errors: t.errors,
    attachments: t.attachments,
  }
}

// Tests of the most recent run on the same branch before this one (regression baseline).
async function previousRunTests(projectId: string, before: Date, branch?: string): Promise<NormTest[]> {
  const conds = [eq(run.projectId, projectId), lt(run.startedAt, before)]
  if (branch)
    conds.push(sql`(${run.git} ->> 'branch') = ${branch}`)

  const [prev] = await db
    .select({ id: run.id })
    .from(run)
    .where(and(...conds))
    .orderBy(desc(run.startedAt))
    .limit(1)
  if (!prev)
    return []

  const rows = await db.query.test.findMany({ where: eq(test.runId, prev.id) })
  return rows.map(rowToNormTest)
}

export async function notifyRun(input: NotifyRunInput): Promise<void> {
  const channel = await db.query.slackIntegration.findFirst({
    where: eq(slackIntegration.projectId, input.projectId),
  })
  if (!channel?.enabled)
    return

  // Alerts are a paid feature (self-host is unlimited).
  const entitlements = await getEntitlements(input.organizationId)
  if (!entitlements.alerts)
    return

  const prevTests = await previousRunTests(input.projectId, input.startedAt, input.branch)
  const deltas = compareRuns(prevTests, input.tests)
  const newlyFailing = deltas.filter(d => d.change === 'broken')
  const newlyFlaky = deltas.filter(d => d.change === 'newly-flaky')

  const fire = channel.policy === 'always'
    || (channel.policy === 'on-failure' && input.counts.unexpected > 0)
    || (channel.policy === 'on-regression' && (newlyFailing.length > 0 || newlyFlaky.length > 0))
  if (!fire)
    return

  const projectRow = await db.query.project.findFirst({
    where: eq(project.id, input.projectId),
    columns: { name: true, slug: true },
  })
  const slug = projectRow?.slug ?? input.projectId

  const message = buildSlackMessage({
    projectName: projectRow?.name ?? 'project',
    runUrl: `${getTrustedOrigins()[0] ?? ''}/projects/${slug}/runs/${input.runId}`,
    counts: input.counts,
    newlyFailing: newlyFailing.map(d => d.title),
    newlyFlaky: newlyFlaky.map(d => d.title),
  })

  try {
    await sendSlack(channel.webhookUrl, message)
  }
  catch (error) {
    logger.error({ error, projectId: input.projectId }, 'slack alert failed')
  }
}
