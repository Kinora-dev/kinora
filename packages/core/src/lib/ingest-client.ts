import type { IngestRun, IngestRunResult } from '../contracts/ingest'
import type { CiMeta, GitMeta } from '../contracts/kinora'
import { ingestRunResultSchema } from '../contracts/ingest'
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
}

export function createIngestClient(opts: IngestClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '')
  const doFetch = opts.fetch ?? globalThis.fetch

  return {
    async uploadRun(input: IngestRun): Promise<IngestRunResult> {
      const res = await doFetch(`${base}/api/v1/runs`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${opts.token}`,
        },
        body: JSON.stringify(input),
      })
      if (!res.ok)
        throw new Error(`kinora ingest failed: ${res.status} ${await res.text()}`)
      return ingestRunResultSchema.parse(await res.json())
    },
  }
}
