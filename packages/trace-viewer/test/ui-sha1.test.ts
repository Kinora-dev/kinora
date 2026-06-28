import { describe, expect, it } from 'vitest'
import { calculateSha1 } from '../src/ui/lib/sha1'

// Trace stores source files as `src@<sha1>.txt`, so the hex digest must match upstream exactly.
describe('calculateSha1', () => {
  it('matches known SHA-1 vectors as lowercase hex', async () => {
    expect(await calculateSha1('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
    expect(await calculateSha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })
})
