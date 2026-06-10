import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { artifact, project } from '../db/schemas/index'
import { logger } from '../lib/logger'
import { storage } from '../lib/storage'
import { orgProcedure, router } from '../trpc/index'
import { ownedProject } from './dashboard'

export const projectRouter = router({
  rename: orgProcedure
    .input(z.object({ projectId: z.string(), name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      await db.update(project).set({ name: input.name }).where(eq(project.id, p.id))
      return { ok: true }
    }),

  updateDescription: orgProcedure
    .input(z.object({ projectId: z.string(), description: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.organizationId, input.projectId)
      await db.update(project).set({ description: input.description }).where(eq(project.id, p.id))
      return { ok: true }
    }),

  delete: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.organizationId, input.projectId)

      // Blobs first; the row delete cascades runs/tests/artifacts.
      const blobs = await db.select({ key: artifact.storageKey }).from(artifact).where(eq(artifact.projectId, p.id))
      for (const blob of blobs) {
        try {
          await storage.delete(blob.key)
        }
        catch (error) {
          logger.error({ error, key: blob.key }, 'project delete: blob delete failed')
        }
      }

      await db.delete(project).where(eq(project.id, p.id))
      return { ok: true }
    }),
})
