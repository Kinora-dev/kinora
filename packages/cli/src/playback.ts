#!/usr/bin/env node
import type { CopyArtifact, Manifest, ProjectEntry, RunSummary } from '@playbackhq/core'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import {
  ingestPlaywrightReport,
  manifestSchema,
  SCHEMA_VERSION,
} from '@playbackhq/core'

const USAGE = `playback ingest - turn a Playwright json report into playback data files

Usage:
  playback <results.json> --project <id> [options]

Required:
  --project <id>        Project id (stable slug, e.g. "web-app")

Options:
  --name <name>         Project display name (defaults to id; updated if given)
  --run <id>            Run id (defaults to the report date, YYYY-MM-DD)
  --out <dir>           Output root served statically (default: playback-data)
  --results-dir <dir>   Playwright test-results dir, to resolve trace.zip paths (default: test-results)
  --git-sha <sha>
  --git-branch <branch>
  --ci-provider <name>
  --ci-run-url <url>
  --ci-run-number <n>
  -h, --help

Writes <out>/reports/<project>/<run>.json and upserts <out>/manifest.json.`

function fail(msg: string): never {
  console.error(`error: ${msg}\n`)
  console.error(USAGE)
  process.exit(1)
}

async function readManifest(file: string): Promise<Manifest> {
  if (!existsSync(file)) {
    return { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), projects: [] }
  }
  const parsed = manifestSchema.safeParse(JSON.parse(await readFile(file, 'utf8')))
  if (!parsed.success) {
    fail(`existing manifest at ${file} is invalid, refusing to overwrite:\n${parsed.error.message}`)
  }
  return parsed.data
}

function upsertRun(manifest: Manifest, projectId: string, name: string, run: RunSummary): void {
  let project: ProjectEntry | undefined = manifest.projects.find(p => p.id === projectId)
  if (!project) {
    project = { id: projectId, name, runs: [] }
    manifest.projects.push(project)
  }
  else if (name) {
    project.name = name
  }
  project.runs = project.runs.filter(r => r.runId !== run.runId)
  project.runs.push(run)
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`)
}

// Copies trace.zip artifacts into <out>/artifacts/<project>/<run>/<sha1>.zip so
// the dashboard can link the trace viewer at one. Traces only, for now.
function makeCopyArtifact(outDir: string, resultsDir: string): CopyArtifact {
  return (att, ctx) => {
    const isTrace = att.name === 'trace' || att.contentType === 'application/zip'
    if (!isTrace)
      return undefined

    let buf: Buffer | undefined
    if (att.path) {
      const file = path.isAbsolute(att.path) ? att.path : path.resolve(resultsDir, att.path)
      if (existsSync(file))
        buf = readFileSync(file)
    }
    if (!buf && att.body)
      buf = Buffer.from(att.body, 'base64')
    if (!buf)
      return undefined

    const sha = createHash('sha1').update(buf).digest('hex').slice(0, 16)
    const rel = `artifacts/${ctx.projectId}/${ctx.runId}/${sha}.zip`
    const dest = path.join(outDir, rel)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    return rel
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'project': { type: 'string' },
      'name': { type: 'string' },
      'run': { type: 'string' },
      'out': { type: 'string', default: 'playback-data' },
      'results-dir': { type: 'string', default: 'test-results' },
      'git-sha': { type: 'string' },
      'git-branch': { type: 'string' },
      'ci-provider': { type: 'string' },
      'ci-run-url': { type: 'string' },
      'ci-run-number': { type: 'string' },
      'help': { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.log(USAGE)
    return
  }
  if (positionals.length !== 1)
    fail('pass exactly one Playwright results.json path')
  if (!values.project)
    fail('--project <id> is required')

  const reportFile = positionals[0]
  if (!existsSync(reportFile))
    fail(`report not found: ${reportFile}`)

  const raw: unknown = JSON.parse(await readFile(reportFile, 'utf8'))

  // Default run id = the report's date.
  const startTime
    = raw && typeof raw === 'object' && 'stats' in raw
      ? (raw as { stats?: { startTime?: string } }).stats?.startTime
      : undefined
  const runId = values.run ?? (startTime ? startTime.slice(0, 10) : new Date().toISOString().slice(0, 10))

  const git
    = values['git-sha'] || values['git-branch']
      ? { sha: values['git-sha'], branch: values['git-branch'] }
      : undefined
  const ci
    = values['ci-provider'] || values['ci-run-url'] || values['ci-run-number']
      ? {
          provider: values['ci-provider'],
          runUrl: values['ci-run-url'],
          runNumber: values['ci-run-number'],
        }
      : undefined

  const outDir = path.resolve(values.out)
  const resultsDir = path.resolve(values['results-dir'] ?? 'test-results')

  const { summary, report } = ingestPlaywrightReport(raw, {
    projectId: values.project,
    runId,
    git,
    ci,
    copyArtifact: makeCopyArtifact(outDir, resultsDir),
  })

  const manifestFile = path.join(outDir, 'manifest.json')

  const manifest = await readManifest(manifestFile)
  upsertRun(manifest, values.project, values.name ?? values.project, summary)
  manifest.generatedAt = new Date().toISOString()

  await writeJson(path.join(outDir, summary.reportPath), report)
  await writeJson(manifestFile, manifest)

  const c = summary.counts
  console.log(
    `ingested ${values.project}/${runId}: ${c.total} tests `
    + `(${c.unexpected} fail, ${c.flaky} flaky, ${c.skipped} skip) -> ${path.relative(process.cwd(), outDir)}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
