import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { augmentedPath } from './editor'

// GUI-launched apps inherit a stripped PATH; augmentedPath re-adds the usual install dirs.
describe('augmentedPath', () => {
  const orig = process.env.PATH

  afterEach(() => {
    process.env.PATH = orig
  })

  it('keeps the existing PATH first, then appends the common install dirs', () => {
    process.env.PATH = '/custom/bin'
    const p = augmentedPath()
    expect(p.startsWith('/custom/bin:')).toBe(true)
    expect(p).toContain('/opt/homebrew/bin')
    expect(p).toContain('/usr/local/bin')
  })

  it('drops a falsy PATH instead of leaving an empty leading segment', () => {
    delete process.env.PATH
    const p = augmentedPath()
    expect(p.startsWith(':')).toBe(false)
    expect(p).toContain('/usr/local/bin')
  })
})
