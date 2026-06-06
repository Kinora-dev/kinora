import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { project, run, test } from '../db/schemas/index'
import { authProcedure, router } from '../trpc/index'

async function assertOwned(userId: string, projectId: string): Promise<void> {
  const p = await db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.userId, userId)),
    columns: { id: true },
  })
  if (!p)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
}

export const runsRouter = router({
  list: authProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertOwned(ctx.user.id, input.projectId)
      return db.query.run.findMany({
        where: eq(run.projectId, input.projectId),
        orderBy: desc(run.startedAt),
      })
    }),

  get: authProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const r = await db.query.run.findFirst({ where: eq(run.id, input.runId) })
      if (!r)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Run not found' })
      await assertOwned(ctx.user.id, r.projectId)
      const tests = await db.query.test.findMany({
        where: eq(test.runId, input.runId),
        orderBy: asc(test.file),
      })
      return { run: r, tests }
    }),
})
