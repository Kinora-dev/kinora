import { TRPCError } from '@trpc/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { project } from '../db/schemas/index'
import { authProcedure, router } from '../trpc/index'

export const projectsRouter = router({
  list: authProcedure.query(async ({ ctx }) => {
    return db.query.project.findMany({
      where: eq(project.userId, ctx.user.id),
      orderBy: desc(project.updatedAt),
      columns: { id: true, slug: true, name: true, createdAt: true, updatedAt: true },
    })
  }),

  get: authProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await db.query.project.findFirst({
        where: and(eq(project.id, input.id), eq(project.userId, ctx.user.id)),
      })
      if (!p)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      return p
    }),
})
