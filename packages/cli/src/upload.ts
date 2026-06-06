import type { CiMeta, GitMeta, IngestRunResult } from '@kinora/core'
import { readFile } from 'node:fs/promises'
import { buildIngestRun, createIngestClient, isTraceAttachment } from '@kinora/core'

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
  const res = await client.uploadRun(payload)

  for (const t of payload.tests) {
    for (const a of t.attachments) {
      if (!a.path || !isTraceAttachment(a))
        continue
      try {
        const art = await client.uploadArtifact({ runId: res.runId, testKey: t.testKey, name: a.name, contentType: a.contentType, body: await readFile(a.path) })
        console.log(`  trace ${t.testKey} -> ${art.url}`)
      }
      catch (err) {
        console.warn(`warning: trace upload failed for ${t.testKey}: ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  return res
}
