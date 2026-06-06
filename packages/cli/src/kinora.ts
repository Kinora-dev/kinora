#!/usr/bin/env node
import type { Manifest, ProjectEntry, RunSummary } from '@kinora/core'
import type { KeepPolicy } from './artifacts'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import {
  ingestPlaywrightReport,
  manifestSchema,
  SCHEMA_VERSION,
} from '@kinora/core'
import { makeCopyArtifact } from './artifacts'

const USAGE = `kinora ingest - turn a Playwright json report into kinora data files

Usage:
  kinora <results.json> --project <id> [options]

Required:
  --project <id>        Project id (stable slug, e.g. "web-app")

Options:
  --name <name>         Project display name (defaults to id; updated if given)
  --run <id>            Run id (defaults to the report date, YYYY-MM-DD)
  --out <dir>           Output root served statically (default: kinora-data)
  --results-dir <dir>   Playwright test-results dir, to resolve trace.zip paths (default: test-results)
  --keep <policy>       which tests' traces to copy: failed | all | none (default: failed)
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

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'project': { type: 'string' },
      'name': { type: 'string' },
      'run': { type: 'string' },
      'out': { type: 'string', default: 'kinora-data' },
      'results-dir': { type: 'string', default: 'test-results' },
      'keep': { type: 'string', default: 'failed' },
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
  const keep = (values.keep ?? 'failed') as KeepPolicy
  if (!['failed', 'all', 'none'].includes(keep))
    fail(`--keep must be one of: failed, all, none (got "${keep}")`)

  const { summary, report } = ingestPlaywrightReport(raw, {
    projectId: values.project,
    runId,
    git,
    ci,
    copyArtifact: makeCopyArtifact(outDir, resultsDir, keep),
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
