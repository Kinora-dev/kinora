import { describe, expect, it } from 'vitest'
import { makeTestKey } from './test-key'

// The cross-run identity contract: the reporter (identity() over the suite tree) and the CLI
// (normalize over results.json) must both produce this exact string or history breaks.
describe('makeTestKey', () => {
  it('joins file, the › separated title path, and project name with ::', () => {
    expect(makeTestKey('a.spec.ts', ['a.spec.ts', 'group', 'does x'], 'chromium'))
      .toBe('a.spec.ts::a.spec.ts › group › does x::chromium')
  })

  it('is stable and distinguishes project, title path, and file', () => {
    const base = makeTestKey('a.spec.ts', ['a.spec.ts', 'x'], 'chromium')
    expect(makeTestKey('a.spec.ts', ['a.spec.ts', 'x'], 'chromium')).toBe(base)
    expect(makeTestKey('a.spec.ts', ['a.spec.ts', 'x'], 'firefox')).not.toBe(base)
    expect(makeTestKey('a.spec.ts', ['a.spec.ts', 'y'], 'chromium')).not.toBe(base)
    expect(makeTestKey('b.spec.ts', ['b.spec.ts', 'x'], 'chromium')).not.toBe(base)
  })
})
