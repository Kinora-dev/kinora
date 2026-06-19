import type { Manifest, NormTest, ProjectEntry, ProjectHistory, RunComparison, RunReport, RunSummary } from '@kinora/core'
import { buildTestHistories, compareRuns, SCHEMA_VERSION } from '@kinora/core'
import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { artifact, project, run, test } from '../db/schemas/index'
import { storage } from '../lib/storage'
import { orgProcedure, router } from '../trpc/index'

type RunRow = typeof run.$inferSelect
type TestRow = typeof test.$inferSelect

// Most-recent runs per project the dashboard loads. Memory bound until the UI gets pagination;
// projects with more runs show this window in trends/history.
export const MAX_DASHBOARD_RUNS = 500

export async function ownedProject(organizationId: string, slug: string) {
  const p = await db.query.project.findFirst({
    where: and(eq(project.slug, slug), eq(project.organizationId, organizationId)),
  })
  if (!p)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
  return p
}

function runSummary(slug: string, r: RunRow): RunSummary {
  return {
    runId: r.id,
    projectId: slug,
    startedAt: r.startedAt.toISOString(),
    duration: r.duration,
    counts: r.counts,
    playwrightVersion: r.playwrightVersion ?? undefined,
    git: r.git ?? undefined,
    ci: r.ci ?? undefined,
    shards: r.shards ?? undefined,
    reportPath: `reports/${slug}/${r.id}.json`,
    countsByTag: r.countsByTag,
  }
}

function toNormTest(t: TestRow, urls?: Map<string, string>): NormTest {
  return {
    testKey: t.testKey,
    title: t.title,
    titlePath: t.titlePath,
    file: t.file,
    line: t.line,
    column: t.column,
    projectName: t.projectName,
    status: t.status,
    ok: t.ok,
    duration: t.duration,
    retries: t.retries,
    tags: t.tags,
    annotations: t.annotations,
    errors: t.errors,
    attachments: t.attachments.map(a => ({ ...a, url: urls?.get(a.name) ?? a.url })),
  }
}

function runReport(slug: string, r: RunRow, tests: TestRow[], urlsByTest?: Map<string, Map<string, string>>): RunReport {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: r.id,
    projectId: slug,
    startedAt: r.startedAt.toISOString(),
    duration: r.duration,
    counts: r.counts,
    meta: { playwrightVersion: r.playwrightVersion ?? undefined, git: r.git ?? undefined, ci: r.ci ?? undefined, shards: r.shards ?? undefined },
    tests: tests.map(t => toNormTest(t, urlsByTest?.get(t.id))),
  }
}

export const dashboardRouter = router({
  manifest: orgProcedure.query(async ({ ctx }): Promise<Manifest> => {
    const projects = await db.query.project.findMany({
      where: eq(project.organizationId, ctx.organizationId),
      orderBy: desc(project.updatedAt),
    })
    // Per-project queries run concurrently (not a sequential N+1) and each is capped so one
    // long-lived project can't load its entire run history into memory.
    const entries: ProjectEntry[] = await Promise.all(projects.map(async (p) => {
      const runs = await db.query.run.findMany({
        where: eq(run.projectId, p.id),
        orderBy: desc(run.startedAt),
        limit: MAX_DASHBOARD_RUNS,
      })
      return { id: p.slug, name: p.name, description: p.description ?? undefined, runs: runs.map(r => runSummary(p.slug, r)) }
    }))
    return { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), projects: entries }
  }),

  run: orgProcedure
    .input(z.object({ projectId: z.string().min(1), runId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<RunReport> => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      const r = await db.query.run.findFirst({ where: and(eq(run.id, input.runId), eq(run.projectId, p.id)) })
      if (!r)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Run not found' })

      const tests = await db.query.test.findMany({ where: eq(test.runId, r.id), orderBy: asc(test.file) })
      const arts = await db.query.artifact.findMany({ where: eq(artifact.runId, r.id) })

      const urlsByTest = new Map<string, Map<string, string>>()
      for (const a of arts) {
        if (!a.testId)
          continue
        const m = urlsByTest.get(a.testId) ?? new Map<string, string>()
        m.set(a.name, await storage.url(a.storageKey))
        urlsByTest.set(a.testId, m)
      }

      return runReport(input.projectId, r, tests, urlsByTest)
    }),

  projectHistory: orgProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<ProjectHistory> => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      // Bound to the most recent runs, then load only those runs' tests (not every test row for the
      // project) so a long-lived project doesn't pull millions of rows into memory.
      const runs = await db.query.run.findMany({ where: eq(run.projectId, p.id), orderBy: desc(run.startedAt), limit: MAX_DASHBOARD_RUNS })
      const runIds = runs.map(r => r.id)
      const windowTests = runIds.length ? await db.query.test.findMany({ where: inArray(test.runId, runIds) }) : []

      const byRun = new Map<string, TestRow[]>()
      for (const t of windowTests) {
        const arr = byRun.get(t.runId) ?? []
        arr.push(t)
        byRun.set(t.runId, arr)
      }

      const reports = runs.map(r => runReport(input.projectId, r, byRun.get(r.id) ?? []))
      const entry: ProjectEntry = { id: p.slug, name: p.name, runs: runs.map(r => runSummary(p.slug, r)) }
      return { project: entry, histories: buildTestHistories(reports) }
    }),

  compareRuns: orgProcedure
    .input(z.object({ projectId: z.string().min(1), baseRunId: z.string().min(1), headRunId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<RunComparison> => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      const [base, head] = await Promise.all([
        db.query.run.findFirst({ where: and(eq(run.id, input.baseRunId), eq(run.projectId, p.id)) }),
        db.query.run.findFirst({ where: and(eq(run.id, input.headRunId), eq(run.projectId, p.id)) }),
      ])
      if (!base || !head)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Run not found' })

      const [baseTests, headTests] = await Promise.all([
        db.query.test.findMany({ where: eq(test.runId, base.id) }),
        db.query.test.findMany({ where: eq(test.runId, head.id) }),
      ])

      return {
        base: { runId: base.id, startedAt: base.startedAt.toISOString(), counts: base.counts, git: base.git ?? undefined },
        head: { runId: head.id, startedAt: head.startedAt.toISOString(), counts: head.counts, git: head.git ?? undefined },
        tests: compareRuns(baseTests.map(t => toNormTest(t)), headTests.map(t => toNormTest(t))),
      }
    }),
})
