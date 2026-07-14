import type { Manifest, ProjectEntry, ProjectHistory, RunComparison, RunReport } from '@kinora/core'
import { compareRuns, SCHEMA_VERSION } from '@kinora/core'
import { TRPCError } from '@trpc/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { project, run, test } from '../db/schemas/index'
import { findProject, loadProjectHistory, loadRun, loadRunReport, loadRunSummaries, MAX_DASHBOARD_RUNS, toNormTest } from '../reports/queries'
import { orgProcedure, router } from '../trpc/index'

export { MAX_DASHBOARD_RUNS }

export async function ownedProject(organizationId: string, slug: string) {
  const p = await findProject(organizationId, slug)
  if (!p)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
  return p
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
      return { id: p.slug, name: p.name, description: p.description ?? undefined, runs: await loadRunSummaries(p) }
    }))
    return { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), projects: entries }
  }),

  run: orgProcedure
    .input(z.object({ projectId: z.string().min(1), runId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<RunReport> => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      const r = await loadRun(p.id, input.runId)
      if (!r)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Run not found' })
      return loadRunReport(p, r)
    }),

  projectHistory: orgProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<ProjectHistory> => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      return loadProjectHistory(p)
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
