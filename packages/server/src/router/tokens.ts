import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { apikey } from '../db/schemas/index'
import { auth } from '../lib/auth'
import { orgProcedure, router } from '../trpc/index'

// Ingest tokens belong to the active org (referenceId = orgId), not the user who created them.
export const tokenRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return db.query.apikey.findMany({
      where: eq(apikey.referenceId, ctx.organizationId),
      columns: { id: true, name: true, start: true, enabled: true, lastRequest: true, createdAt: true },
      orderBy: desc(apikey.createdAt),
    })
  }),

  create: orgProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const created = await auth.api.createApiKey({ body: { name: input.name, userId: ctx.user.id } })
      await db.update(apikey).set({ referenceId: ctx.organizationId }).where(eq(apikey.id, created.id))
      // The plaintext key is shown once.
      return { key: created.key }
    }),

  revoke: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(apikey).where(and(eq(apikey.id, input.id), eq(apikey.referenceId, ctx.organizationId)))
      return { ok: true }
    }),
})
