import type { CiMeta, GitMeta, IngestRunResult } from '@kinora/core'
import { buildIngestRun, createIngestClient } from '@kinora/core'

export interface UploadOptions {
  project: { slug: string, name?: string }
  url: string
  token: string
  git?: GitMeta
  ci?: CiMeta
  fetch?: typeof globalThis.fetch
}

// Parse a Playwright json report and upload it to a kinora server. Shares the
// normalize + ingest-client logic with the reporter via @kinora/core.
export async function uploadReport(raw: unknown, opts: UploadOptions): Promise<IngestRunResult> {
  const payload = buildIngestRun(raw, {
    project: { slug: opts.project.slug, name: opts.project.name ?? opts.project.slug },
    git: opts.git,
    ci: opts.ci,
  })
  const client = createIngestClient({ baseUrl: opts.url, token: opts.token, fetch: opts.fetch })
  return client.uploadRun(payload)
}
