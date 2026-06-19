import { describe, expect, it } from 'vitest'
import { testLabel } from './test-display'

describe('testLabel', () => {
  it('drops the leading file and joins the suite path', () => {
    expect(testLabel({ titlePath: ['a/b.spec.ts', 'Group', 'does a thing'], title: 'does a thing' }))
      .toBe('Group › does a thing')
  })

  it('handles a file + title with no suite', () => {
    expect(testLabel({ titlePath: ['a/b.spec.ts', 'does a thing'], title: 'does a thing' }))
      .toBe('does a thing')
  })

  it('falls back to the title when there is no suite hierarchy', () => {
    expect(testLabel({ titlePath: ['a/b.spec.ts'], title: 'does a thing' })).toBe('does a thing')
  })
})
