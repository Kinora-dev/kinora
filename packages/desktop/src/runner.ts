import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import type { FSWatcher } from 'node:fs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { augmentedPath } from './editor'

const IGNORE_DIRS = ['node_modules', '.git', 'test-results', 'playwright-report', 'dist', 'build', '.output', '.next', '.nuxt', 'coverage']
const WATCH_EXT = /\.(?:tsx?|jsx?|mjs|cjs|vue)$/

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

// Watch the repo for source edits (debounced) and fire onChange. Returns a stop fn.
// Trace output lives in a temp dir, so runs don't re-trigger the watch.
export function watchRepo(repoRoot: string, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let watcher: FSWatcher | undefined
  try {
    watcher = fs.watch(repoRoot, { recursive: true }, (_event, filename) => {
      if (!filename)
        return
      const f = filename.toString()
      if (f.split(path.sep).some(seg => IGNORE_DIRS.includes(seg)) || !WATCH_EXT.test(f))
        return
      clearTimeout(timer)
      timer = setTimeout(onChange, 300)
    })
  }
  catch {
    // Recursive watch is unsupported on some platforms (e.g. Linux); watch becomes a no-op.
  }
  return () => {
    clearTimeout(timer)
    watcher?.close()
  }
}
