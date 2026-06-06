import type { Counts, NormTest, RunReport, RunSummary } from '../contracts/kinora'
import type { PlaywrightReport, PwSpec } from '../contracts/playwright'
import { SCHEMA_VERSION } from '../contracts/kinora'
import { playwrightReportSchema } from '../contracts/playwright'
import { makeTestKey } from './test-key'

// Provided by the CLI (which has fs access): copies a Playwright attachment
// (from disk path or inline base64 body) somewhere hostable and returns a
// relative URL. Core stays fs-free; the side effect is injected.
export type CopyArtifact = (
  attachment: { name: string, contentType: string, path?: string, body?: string },
  ctx: { projectId: string, runId: string, testKey: string, status: NormTest['status'] },
) => string | undefined

export interface IngestMeta {
  projectId: string
  runId: string
  git?: RunSummary['git']
  ci?: RunSummary['ci']
  copyArtifact?: CopyArtifact
}

interface WalkCtx {
  titlePath: string[]
  file: string
}

function flattenSpecs(
  suites: PlaywrightReport['suites'],
  parent: WalkCtx,
  out: NormTest[],
  meta: IngestMeta,
): void {
  for (const suite of suites) {
    const ctx: WalkCtx = {
      file: suite.file || parent.file,
      titlePath: suite.title ? [...parent.titlePath, suite.title] : parent.titlePath,
    }
    for (const spec of suite.specs) normalizeSpec(spec, ctx, out, meta)
    if (suite.suites)
      flattenSpecs(suite.suites, ctx, out, meta)
  }
}

function normalizeSpec(spec: PwSpec, ctx: WalkCtx, out: NormTest[], meta: IngestMeta): void {
  const file = spec.file || ctx.file
  const titlePath = [...ctx.titlePath, spec.title]
  for (const test of spec.tests) {
    const last = test.results.at(-1)
    const testKey = makeTestKey(file, titlePath, test.projectName)
    out.push({
      testKey,
      title: spec.title,
      titlePath,
      file,
      line: spec.line,
      column: spec.column,
      projectName: test.projectName,
      status: test.status,
      ok: spec.ok,
      duration: test.results.reduce((s, r) => s + r.duration, 0),
      retries: Math.max(0, test.results.length - 1),
      tags: spec.tags,
      annotations: test.annotations.map(a => ({ type: a.type, description: a.description })),
      errors: (last?.errors ?? []).flatMap(e =>
        e.message ? [{ message: e.message, stack: e.stack, location: e.location }] : [],
      ),
      attachments: (last?.attachments ?? []).map(a => ({
        name: a.name,
        contentType: a.contentType,
        path: a.path,
        hasBody: a.body != null,
        url: meta.copyArtifact?.(
          { name: a.name, contentType: a.contentType, path: a.path, body: a.body },
          { projectId: meta.projectId, runId: meta.runId, testKey, status: test.status },
        ),
      })),
    })
  }
}

function countsFrom(report: PlaywrightReport, tests: NormTest[]): Counts {
  const s = report.stats
  return {
    total: tests.length,
    expected: s.expected,
    unexpected: s.unexpected,
    flaky: s.flaky,
    skipped: s.skipped,
  }
}

function emptyCounts(): Counts {
  return { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 }
}

function countsByTagFrom(tests: NormTest[]): Record<string, Counts> {
  const out: Record<string, Counts> = {}
  for (const t of tests) {
    for (const tag of t.tags) {
      const c = (out[tag] ??= emptyCounts())
      c.total++
      c[t.status]++
    }
  }
  return out
}

// Parse + normalize a raw Playwright JSON report into the kinora contract.
// Attachment bodies are dropped (only metadata kept) to keep payloads small.
export function ingestPlaywrightReport(
  raw: unknown,
  meta: IngestMeta,
): { summary: RunSummary, report: RunReport } {
  const parsed: PlaywrightReport = playwrightReportSchema.parse(raw)
  const tests: NormTest[] = []
  flattenSpecs(parsed.suites, { titlePath: [], file: '' }, tests, meta)

  const counts = countsFrom(parsed, tests)
  const startedAt = parsed.stats.startTime
  const duration = parsed.stats.duration
  const playwrightVersion = parsed.config?.version

  const reportPath = `reports/${meta.projectId}/${meta.runId}.json`
  const summary: RunSummary = {
    runId: meta.runId,
    projectId: meta.projectId,
    startedAt,
    duration,
    counts,
    playwrightVersion,
    git: meta.git,
    ci: meta.ci,
    reportPath,
    countsByTag: countsByTagFrom(tests),
  }
  const report: RunReport = {
    schemaVersion: SCHEMA_VERSION,
    runId: meta.runId,
    projectId: meta.projectId,
    startedAt,
    duration,
    counts,
    meta: { playwrightVersion, git: meta.git, ci: meta.ci },
    tests,
  }
  return { summary, report }
}
