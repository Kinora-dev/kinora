import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveTest } from './resolve'

// A monorepo-ish layout: config in pkg/, tests in pkg/e2e/, a decoy under node_modules.
let root: string
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'kinora-resolve-'))
  mkdirSync(path.join(root, 'pkg', 'e2e'), { recursive: true })
  mkdirSync(path.join(root, 'pkg', 'node_modules', 'dep'), { recursive: true })
  writeFileSync(path.join(root, 'pkg', 'playwright.config.ts'), '')
  writeFileSync(path.join(root, 'pkg', 'e2e', 'auth.spec.ts'), '')
  writeFileSync(path.join(root, 'pkg', 'node_modules', 'dep', 'auth.spec.ts'), '')
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('resolveTest', () => {
  it('finds a testDir-relative file and the config dir above it', () => {
    const r = resolveTest(root, 'auth.spec.ts')
    expect(r?.absFile).toBe(path.join(root, 'pkg', 'e2e', 'auth.spec.ts'))
    expect(r?.configDir).toBe(path.join(root, 'pkg'))
    expect(r?.rel).toBe(path.join('e2e', 'auth.spec.ts'))
  })

  it('ignores node_modules when searching', () => {
    expect(resolveTest(root, 'auth.spec.ts')?.absFile).not.toContain('node_modules')
  })

  it('uses the direct join when the file is already repo-relative', () => {
    const r = resolveTest(path.join(root, 'pkg'), 'e2e/auth.spec.ts')
    expect(r?.absFile).toBe(path.join(root, 'pkg', 'e2e', 'auth.spec.ts'))
    expect(r?.configDir).toBe(path.join(root, 'pkg'))
  })

  it('does not match on a partial filename boundary', () => {
    // "my-auth.spec.ts" must not satisfy a search for "auth.spec.ts".
    writeFileSync(path.join(root, 'pkg', 'e2e', 'my-auth.spec.ts'), '')
    expect(resolveTest(root, 'extra.spec.ts')).toBeNull()
  })

  it('returns null when the file is not found', () => {
    expect(resolveTest(root, 'missing.spec.ts')).toBeNull()
  })
})
