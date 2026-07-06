import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildFixPrompt, buildRetryPrompt, collectAgentDiff, extractSessionId, formatAgentEvent, gitSnapshot, newlyChanged, parsePorcelainZ, revertAgentChanges } from './agent'

describe('buildFixPrompt', () => {
  it('includes the test identity and the error', () => {
    const p = buildFixPrompt({ title: 'checkout works', absFile: '/repo/e2e/checkout.spec.ts', line: 12, projectName: 'chromium', status: 'unexpected', errors: 'expect(received).toBe(expected)' })
    expect(p).toContain('checkout works')
    expect(p).toContain('/repo/e2e/checkout.spec.ts:12')
    expect(p).toContain('chromium')
    expect(p).toContain('expect(received).toBe(expected)')
    expect(p).toContain('Do not run the test')
  })

  it('embeds the trace error-context when present', () => {
    const p = buildFixPrompt({ title: 't', absFile: '/f.ts', line: 1, status: 'unexpected', errors: 'boom', errorContext: '# Test info\n- Page snapshot' })
    expect(p).toContain('Context from the Playwright trace')
    expect(p).toContain('- Page snapshot')
    // Constraints stay last so they read as the operative instructions.
    expect(p.indexOf('Constraints:')).toBeGreaterThan(p.indexOf('- Page snapshot'))
  })

  it('falls back when there is no error or project', () => {
    const p = buildFixPrompt({ title: 't', absFile: '/f.ts', line: 1, status: 'unexpected', errors: '' })
    expect(p).toContain('(no error captured)')
    expect(p).toContain('(default)')
  })
})

describe('buildRetryPrompt', () => {
  it('embeds the re-run output and keeps the constraints', () => {
    const p = buildRetryPrompt('1 failed\n  expect(x).toBe(y)')
    expect(p).toContain('expect(x).toBe(y)')
    expect(p).toContain('don\'t run anything yourself')
  })
})

describe('extractSessionId', () => {
  it('reads the session id off the init event only', () => {
    expect(extractSessionId(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc-123' }))).toBe('abc-123')
    expect(extractSessionId(JSON.stringify({ type: 'result', session_id: 'abc-123' }))).toBeNull()
    expect(extractSessionId('not json')).toBeNull()
  })
})

describe('formatAgentEvent', () => {
  it('renders init with the model', () => {
    expect(formatAgentEvent(JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-sonnet-5' })))
      .toBe('▸ agent started (claude-sonnet-5)\n')
  })

  it('renders assistant text and tool use', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [
        { type: 'text', text: 'Looking at the selector.' },
        { type: 'tool_use', name: 'Edit', input: { file_path: 'e2e/checkout.spec.ts' } },
      ] },
    })
    expect(formatAgentEvent(line)).toBe('Looking at the selector.\n▸ Edit e2e/checkout.spec.ts\n')
  })

  it('skips tool results and empty assistant messages', () => {
    expect(formatAgentEvent(JSON.stringify({ type: 'user', message: { content: [] } }))).toBeNull()
    expect(formatAgentEvent(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '  ' }] } }))).toBeNull()
  })

  it('renders success and error results', () => {
    expect(formatAgentEvent(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'done' }))).toBe('✔ agent finished\n')
    expect(formatAgentEvent(JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, result: 'max turns' }))).toBe('✖ agent errored: max turns\n')
  })

  it('passes non-JSON lines through as-is', () => {
    expect(formatAgentEvent('plain startup line')).toBe('plain startup line\n')
  })
})

describe('parsePorcelainZ', () => {
  it('parses modified, deleted and untracked entries', () => {
    const out = ' M src/a.ts\0 D src/b.ts\0?? src/new.ts\0'
    expect(parsePorcelainZ(out)).toEqual(new Map([
      ['src/a.ts', ' M'],
      ['src/b.ts', ' D'],
      ['src/new.ts', '??'],
    ]))
  })

  it('consumes the origin path of a staged rename', () => {
    const out = 'R  new-name.ts\0old-name.ts\0 M other.ts\0'
    const m = parsePorcelainZ(out)
    expect(m.get('new-name.ts')).toBe('R ')
    expect(m.has('old-name.ts')).toBe(false)
    expect(m.get('other.ts')).toBe(' M')
  })

  it('handles paths with spaces (no quoting in -z mode)', () => {
    const out = '?? my tests/checkout spec.ts\0'
    expect(parsePorcelainZ(out).get('my tests/checkout spec.ts')).toBe('??')
  })
})

describe('git snapshot / diff / revert (real git)', () => {
  function setupRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinora-agent-'))
    const git = (...args: string[]): void => {
      execFileSync('git', args, { cwd: dir })
    }
    git('init', '-q')
    git('config', 'user.email', 'test@kinora.dev')
    git('config', 'user.name', 'test')
    fs.writeFileSync(path.join(dir, 'a.ts'), 'export const a = 1\n')
    fs.writeFileSync(path.join(dir, 'user.ts'), 'export const u = 1\n')
    git('add', '-A')
    git('commit', '-qm', 'init')
    return dir
  }

  it('attributes only agent edits, diffs untracked files, and reverts cleanly', async () => {
    const dir = setupRepo()
    try {
      // The user already had uncommitted work before the agent ran.
      fs.writeFileSync(path.join(dir, 'user.ts'), 'export const u = 2\n')
      const snap = await gitSnapshot(dir)
      expect(snap).not.toBeNull()
      expect([...snap!.dirty]).toEqual(['user.ts'])

      // The "agent" edits a tracked file and creates a new one.
      fs.writeFileSync(path.join(dir, 'a.ts'), 'export const a = 2\n')
      fs.writeFileSync(path.join(dir, 'new.ts'), 'export const n = 1\n')

      const { changes, diff } = await collectAgentDiff(snap!)
      expect(changes.map(c => c.path).sort()).toEqual(['a.ts', 'new.ts'])
      expect(diff).toContain('-export const a = 1')
      expect(diff).toContain('+export const a = 2')
      expect(diff).toContain('+export const n = 1')
      // The user's own change never shows up as the agent's.
      expect(diff).not.toContain('const u')

      await revertAgentChanges(snap!, changes)
      expect(fs.readFileSync(path.join(dir, 'a.ts'), 'utf8')).toBe('export const a = 1\n')
      expect(fs.existsSync(path.join(dir, 'new.ts'))).toBe(false)
      // Revert leaves the user's pre-existing edit alone.
      expect(fs.readFileSync(path.join(dir, 'user.ts'), 'utf8')).toBe('export const u = 2\n')
    }
    finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns null outside a git repo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinora-nogit-'))
    try {
      expect(await gitSnapshot(dir)).toBeNull()
    }
    finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('newlyChanged', () => {
  it('attributes only paths that were clean before the agent ran', () => {
    const before = new Set(['already-dirty.ts'])
    const after = new Map([
      ['already-dirty.ts', ' M'],
      ['agent-edited.ts', ' M'],
      ['agent-created.ts', '??'],
    ])
    expect(newlyChanged(before, after)).toEqual([
      { path: 'agent-edited.ts', untracked: false },
      { path: 'agent-created.ts', untracked: true },
    ])
  })

  it('returns nothing when the agent changed nothing', () => {
    expect(newlyChanged(new Set(['a.ts']), new Map([['a.ts', ' M']]))).toEqual([])
  })
})
