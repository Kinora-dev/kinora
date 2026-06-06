import { z } from 'zod'
import { ciMetaSchema, countsSchema, gitMetaSchema, normTestSchema } from './kinora'

// Wire contract for the public ingest API (POST /api/v1/runs). The server
// assigns project/run ids, so the client only sends the project slug + run data.
export const ingestRunSchema = z.object({
  project: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
  run: z.object({
    startedAt: z.string(), // ISO 8601
    duration: z.number(),
    counts: countsSchema,
    playwrightVersion: z.string().optional(),
    git: gitMetaSchema.optional(),
    ci: ciMetaSchema.optional(),
    shards: z.number().optional(),
  }),
  tests: z.array(normTestSchema),
})
export type IngestRun = z.infer<typeof ingestRunSchema>

export const ingestRunResultSchema = z.object({
  projectId: z.string(),
  runId: z.string(),
  tests: z.number(),
})
export type IngestRunResult = z.infer<typeof ingestRunResultSchema>

export const uploadArtifactResultSchema = z.object({
  url: z.string(),
})
export type UploadArtifactResult = z.infer<typeof uploadArtifactResultSchema>
