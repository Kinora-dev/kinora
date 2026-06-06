#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { uploadReport } from './upload'

const USAGE = `kinora - upload a Playwright json report to a kinora server

Usage:
  kinora upload <results.json> --project <slug> [options]

Required:
  --project <slug>      Target project slug

Auth (or via env KINORA_TOKEN / KINORA_URL):
  --token <token>       Project API token
  --url <url>           kinora server base URL

Options:
  --name <name>         Project display name (default: slug)
  --git-sha <sha>
  --git-branch <branch>
  --ci-provider <name>
  --ci-run-url <url>
  --ci-run-number <n>
  -h, --help`

function fail(msg: string): never {
  console.error(`error: ${msg}\n`)
  console.error(USAGE)
  process.exit(1)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'project': { type: 'string' },
      'name': { type: 'string' },
      'token': { type: 'string' },
      'url': { type: 'string' },
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

  // Accept both `kinora upload <file>` and `kinora <file>`.
  const args = positionals[0] === 'upload' ? positionals.slice(1) : positionals
  if (args.length !== 1)
    fail('pass exactly one Playwright results.json path')
  if (!values.project)
    fail('--project <slug> is required')

  const reportFile = args[0]
  if (!existsSync(reportFile))
    fail(`report not found: ${reportFile}`)

  const url = values.url ?? process.env.KINORA_URL
  const token = values.token ?? process.env.KINORA_TOKEN
  if (!url)
    fail('--url or KINORA_URL is required')
  if (!token)
    fail('--token or KINORA_TOKEN is required')

  const git = values['git-sha'] || values['git-branch']
    ? { sha: values['git-sha'], branch: values['git-branch'] }
    : undefined
  const ci = values['ci-provider'] || values['ci-run-url'] || values['ci-run-number']
    ? { provider: values['ci-provider'], runUrl: values['ci-run-url'], runNumber: values['ci-run-number'] }
    : undefined

  const raw: unknown = JSON.parse(await readFile(reportFile, 'utf8'))
  const res = await uploadReport(raw, {
    project: { slug: values.project, name: values.name },
    url,
    token,
    git,
    ci,
  })

  console.log(`uploaded ${res.tests} tests to ${values.project} (run ${res.runId})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
