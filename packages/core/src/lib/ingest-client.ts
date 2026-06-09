import type { IngestRun, IngestRunResult, UploadArtifactResult } from '../contracts/ingest'
import type { CiMeta, GitMeta } from '../contracts/kinora'
import { ingestRunResultSchema, uploadArtifactResultSchema } from '../contracts/ingest'
import { ingestPlaywrightReport } from './normalize'

export interface BuildIngestRunOptions {
  project: { slug: string, name: string }
  git?: GitMeta
  ci?: CiMeta
  shards?: number
}

// Map a raw Playwright JSON report into the ingest wire payload. Shared by the
// CLI (reads results.json) - the reporter maps the reporter API directly.
export function buildIngestRun(raw: unknown, opts: BuildIngestRunOptions): IngestRun {
  const { report } = ingestPlaywrightReport(raw, {
    projectId: '',
    runId: '',
    git: opts.git,
    ci: opts.ci,
  })
  return {
    project: opts.project,
    run: {
      startedAt: report.startedAt,
      duration: report.duration,
      counts: report.counts,
      playwrightVersion: report.meta.playwrightVersion,
      git: opts.git,
      ci: opts.ci,
      shards: opts.shards,
    },
    tests: report.tests,
  }
}

export interface IngestClientOptions {
  baseUrl: string
  token: string
  fetch?: typeof globalThis.fetch
  // Historical/bulk import: tells the server to skip alerts for these runs.
  backfill?: boolean
}

export interface UploadArtifactInput {
  runId: string
  testKey: string
  name: string
  contentType: string
  body: Uint8Array | Blob
}

export class IngestError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'IngestError'
    this.status = status
  }
}

// Prefer the server's JSON `error` field (human-readable, e.g. plan-limit messages).
async function toIngestError(res: Response, fallback: string): Promise<IngestError> {
  const text = await res.text()
  let message = text || fallback
  try {
    const body = JSON.parse(text) as { error?: unknown }
    if (typeof body.error === 'string')
      message = body.error
  }
  catch {
    // non-JSON body: keep the raw text / fallback
  }
  return new IngestError(res.status, message)
}

export function createIngestClient(opts: IngestClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '')
  const doFetch = opts.fetch ?? globalThis.fetch
  const auth = `Bearer ${opts.token}`
  const runsUrl = `${base}/api/v1/runs${opts.backfill ? '?backfill=1' : ''}`

  return {
    async uploadRun(input: IngestRun): Promise<IngestRunResult> {
      const res = await doFetch(runsUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': auth },
        body: JSON.stringify(input),
      })
      if (!res.ok)
        throw await toIngestError(res, `kinora ingest failed (${res.status})`)
      return ingestRunResultSchema.parse(await res.json())
    },

    async uploadArtifact(input: UploadArtifactInput): Promise<UploadArtifactResult> {
      // Cast the typed-array generic so this compiles under both node and DOM libs.
      const blob = input.body instanceof Blob ? input.body : new Blob([input.body as Uint8Array<ArrayBuffer>], { type: input.contentType })
      const form = new FormData()
      form.set('file', blob, input.name)
      form.set('testKey', input.testKey)
      form.set('name', input.name)
      // No content-type header: fetch sets the multipart boundary.
      const res = await doFetch(`${base}/api/v1/runs/${encodeURIComponent(input.runId)}/artifacts`, {
        method: 'POST',
        headers: { authorization: auth },
        body: form,
      })
      if (!res.ok)
        throw await toIngestError(res, `kinora artifact upload failed (${res.status})`)
      return uploadArtifactResultSchema.parse(await res.json())
    },
  }
}

// Trace-like attachments worth uploading (the viewer's flagship input).
export function isTraceAttachment(a: { name: string, contentType: string, path?: string }): boolean {
  return !!a.path && (a.name === 'trace' || a.contentType === 'application/zip' || a.path.endsWith('.zip'))
}
