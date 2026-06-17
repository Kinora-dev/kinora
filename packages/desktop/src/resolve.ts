import fs from 'node:fs'
import path from 'node:path'

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.output', '.next', '.nuxt', 'coverage', 'test-results', 'playwright-report'])
const CONFIG_RE = /^playwright\.config\.[cm]?[jt]s$/

export interface Resolved {
  absFile: string // the test file on disk
  configDir: string // nearest dir with a playwright config (re-run cwd)
  rel: string // absFile relative to configDir (re-run location filter)
}

// Playwright reports `file` relative to its rootDir (= testDir), not the repo root, so a
// linked monorepo root won't join cleanly. Find the file under the repo, then the
// playwright config above it, so open-in-editor and re-run both work from one link.
export function resolveTest(repoRoot: string, file: string): Resolved | null {
  const direct = path.join(repoRoot, file)
  const absFile = fs.existsSync(direct) ? direct : findBySuffix(repoRoot, file)
  if (!absFile)
    return null
  const configDir = findConfigDir(path.dirname(absFile), repoRoot) ?? repoRoot
  return { absFile, configDir, rel: path.relative(configDir, absFile) }
}

function findBySuffix(root: string, file: string): string | null {
  const want = path.sep + file.split('/').join(path.sep)
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    }
    catch {
      continue
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (!SKIP.has(e.name))
          stack.push(full)
      }
      else if (full.endsWith(want)) {
        return full
      }
    }
  }
  return null
}

function findConfigDir(start: string, repoRoot: string): string | null {
  let dir = start
  for (;;) {
    try {
      if (fs.readdirSync(dir).some(f => CONFIG_RE.test(f)))
        return dir
    }
    catch {
      // unreadable dir: keep walking up
    }
    if (dir === repoRoot)
      return null
    const up = path.dirname(dir)
    if (up === dir)
      return null
    dir = up
  }
}
