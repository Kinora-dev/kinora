import { randomUUID } from 'node:crypto'
import { ciMetaSchema, countsSchema, gitMetaSchema, normTestSchema } from '@kinora/core'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { project, run, test } from '../db/schemas/index'
import { apiKeyProcedure, router } from '../trpc/index'

const ingestInput = z.object({
  project: z.object({ slug: z.string().min(1), name: z.string().min(1) }),
  run: z.object({
    startedAt: z.string(),
    duration: z.number(),
    counts: countsSchema,
    playwrightVersion: z.string().optional(),
    git: gitMetaSchema.optional(),
    ci: ciMetaSchema.optional(),
    shards: z.number().optional(),
  }),
  tests: z.array(normTestSchema),
})

export const ingestRouter = router({
  run: apiKeyProcedure
    .input(ingestInput)
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx

      return db.transaction(async (tx) => {
        const existing = await tx.query.project.findFirst({
          where: and(eq(project.userId, userId), eq(project.slug, input.project.slug)),
          columns: { id: true },
        })

        let projectId = existing?.id
        if (!projectId) {
          projectId = randomUUID()
          await tx.insert(project).values({
            id: projectId,
            userId,
            slug: input.project.slug,
            name: input.project.name,
          })
        }

        const runId = randomUUID()
        await tx.insert(run).values({
          id: runId,
          projectId,
          startedAt: new Date(input.run.startedAt),
          duration: input.run.duration,
          counts: input.run.counts,
          playwrightVersion: input.run.playwrightVersion,
          git: input.run.git,
          ci: input.run.ci,
          shards: input.run.shards,
        })

        if (input.tests.length) {
          await tx.insert(test).values(input.tests.map(item => ({
            id: randomUUID(),
            runId,
            projectId,
            testKey: item.testKey,
            title: item.title,
            titlePath: item.titlePath,
            file: item.file,
            line: item.line,
            column: item.column,
            projectName: item.projectName,
            status: item.status,
            ok: item.ok,
            duration: item.duration,
            retries: item.retries,
            tags: item.tags,
            annotations: item.annotations,
            errors: item.errors,
            attachments: item.attachments,
          })))
        }

        return { projectId, runId, tests: input.tests.length }
      })
    }),
})
