import { z } from 'zod'
import { ciMetaSchema, countsSchema, gitMetaSchema, normTestSchema } from './kinora'

// Upper bound on tests in one run upload. Far above any real Playwright run/shard; bounds the
// bulk insert so a crafted body can't ask for millions of rows. Pairs with the JSON body limit.
export const MAX_TESTS_PER_RUN = 50_000

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
  tests: z.array(normTestSchema).max(MAX_TESTS_PER_RUN),
})
export type IngestRun = z.infer<typeof ingestRunSchema>

const regressionTestSchema = z.object({
  testKey: z.string(),
  title: z.string(),
  file: z.string(),
})

// What the ingested run changed vs its comparison baseline; drives the GitHub PR comment.
export const runRegressionSchema = z.object({
  // Which baseline we diffed against.
  base: z.enum(['base-branch', 'previous-run', 'none']),
  newlyFailing: z.array(regressionTestSchema),
  newlyFlaky: z.array(regressionTestSchema),
  fixed: z.number(),
})
export type RunRegression = z.infer<typeof runRegressionSchema>

export const ingestRunResultSchema = z.object({
  projectId: z.string(),
  runId: z.string(),
  tests: z.number(),
  // Durable dashboard run URL (built server-side from WEB_ORIGIN). Optional: older servers omit it.
  runUrl: z.string().optional(),
  regression: runRegressionSchema.optional(),
})
export type IngestRunResult = z.infer<typeof ingestRunResultSchema>

export const uploadArtifactResultSchema = z.object({
  url: z.string(),
})
export type UploadArtifactResult = z.infer<typeof uploadArtifactResultSchema>
