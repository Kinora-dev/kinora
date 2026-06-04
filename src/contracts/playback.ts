import { z } from 'zod'
import { pwTestStatus } from './playwright'

export const SCHEMA_VERSION = 1

export const countsSchema = z.object({
  total: z.number(),
  expected: z.number(),
  unexpected: z.number(),
  flaky: z.number(),
  skipped: z.number(),
})
export type Counts = z.infer<typeof countsSchema>

export const gitMetaSchema = z.object({
  sha: z.string().optional(),
  branch: z.string().optional(),
  message: z.string().optional(),
})

export const ciMetaSchema = z.object({
  provider: z.string().optional(),
  runUrl: z.string().optional(),
  runNumber: z.string().optional(),
})

// One row per run, stored in the manifest. Kept small: powers the overview
// grid and history charts without fetching full reports.
export const runSummarySchema = z.object({
  runId: z.string(),
  projectId: z.string(),
  startedAt: z.string(), // ISO 8601
  duration: z.number(), // ms
  counts: countsSchema,
  playwrightVersion: z.string().optional(),
  git: gitMetaSchema.optional(),
  ci: ciMetaSchema.optional(),
  shards: z.number().optional(),
  reportPath: z.string(), // relative path to the full RunReport JSON
})
export type RunSummary = z.infer<typeof runSummarySchema>

export const projectEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  runs: z.array(runSummarySchema),
})
export type ProjectEntry = z.infer<typeof projectEntrySchema>

// Root document the front fetches first. Single static file.
export const manifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.string(),
  projects: z.array(projectEntrySchema),
})
export type Manifest = z.infer<typeof manifestSchema>

export const normAttachmentSchema = z.object({
  name: z.string(),
  contentType: z.string(),
  path: z.string().optional(),
  hasBody: z.boolean(), // body stripped on ingest; flag that one existed
})

export const normErrorSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  location: z
    .object({ file: z.string(), line: z.number(), column: z.number() })
    .optional(),
})

// Flattened test, identity stable across runs via testKey.
export const normTestSchema = z.object({
  testKey: z.string(),
  title: z.string(),
  titlePath: z.array(z.string()),
  file: z.string(),
  line: z.number(),
  column: z.number(),
  projectName: z.string(), // playwright project (e.g. browser), not playback project
  status: pwTestStatus,
  ok: z.boolean(),
  duration: z.number(),
  retries: z.number(),
  tags: z.array(z.string()),
  annotations: z.array(z.object({ type: z.string(), description: z.string().optional() })),
  errors: z.array(normErrorSchema),
  attachments: z.array(normAttachmentSchema),
})
export type NormTest = z.infer<typeof normTestSchema>

// Full per-run document, fetched lazily on drill-down. Attachment bodies stripped.
export const runReportSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  runId: z.string(),
  projectId: z.string(),
  startedAt: z.string(),
  duration: z.number(),
  counts: countsSchema,
  meta: z.object({
    playwrightVersion: z.string().optional(),
    git: gitMetaSchema.optional(),
    ci: ciMetaSchema.optional(),
    shards: z.number().optional(),
  }),
  tests: z.array(normTestSchema),
})
export type RunReport = z.infer<typeof runReportSchema>
