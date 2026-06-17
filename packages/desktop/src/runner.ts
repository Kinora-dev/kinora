import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { augmentedPath } from './editor'

export interface RerunOpts {
  repoRoot: string
  file: string
  line: number
  projectName?: string
  outDir: string
}

export interface RerunResult {
  ok: boolean
  code: number
  tracePath: string | null
}

// Prefer the repo's own playwright; fall back to npx without auto-installing.
function playwrightInvocation(root: string): { cmd: string, pre: string[] } {
  const local = path.join(root, 'node_modules', '.bin', 'playwright')
  return fs.existsSync(local) ? { cmd: local, pre: [] } : { cmd: 'npx', pre: ['--no-install', 'playwright'] }
}

function findTrace(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir, { recursive: true }) as string[]
    const zips = files.filter(f => f.endsWith('trace.zip')).map(f => path.join(dir, f))
    if (!zips.length)
      return null
    return zips.map(f => ({ f, t: fs.statSync(f).mtimeMs })).sort((a, b) => b.t - a.t)[0].f
  }
  catch {
    return null
  }
}

// Spawn `playwright test <file>:<line>` in the repo, forcing a fresh trace. Streams
// combined stdout/stderr via onOutput; reports the trace path (if any) via onDone.
export function startRerun(opts: RerunOpts, onOutput: (chunk: string) => void, onDone: (r: RerunResult) => void): ChildProcess {
  const { cmd, pre } = playwrightInvocation(opts.repoRoot)
  const loc = `${opts.file}:${opts.line}`
  const args = [...pre, 'test', loc, '--trace', 'on', '--output', opts.outDir, '--reporter', 'line']
  if (opts.projectName)
    args.push('--project', opts.projectName)
  onOutput(`$ playwright test ${loc}${opts.projectName ? ` --project ${opts.projectName}` : ''}\n`)
  const child = spawn(cmd, args, { cwd: opts.repoRoot, env: { ...process.env, PATH: augmentedPath() } })
  const pipe = (chunk: Buffer): void => onOutput(chunk.toString())
  child.stdout?.on('data', pipe)
  child.stderr?.on('data', pipe)
  child.on('error', (err) => {
    onOutput(`\n${err.message}\n`)
    onDone({ ok: false, code: -1, tracePath: null })
  })
  child.on('close', code => onDone({ ok: code === 0, code: code ?? -1, tracePath: findTrace(opts.outDir) }))
  return child
}
