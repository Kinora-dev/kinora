import { describe, expect, it } from 'vitest'
import { stripAnsi } from './ansi'

const E = String.fromCharCode(0x1B)

describe('stripAnsi', () => {
  it('strips SGR colour codes from Playwright errors', () => {
    expect(stripAnsi(`${E}[2mexpect(${E}[22m${E}[31mlocator${E}[39m${E}[2m).${E}[22mtoBeVisible()`))
      .toBe('expect(locator).toBeVisible()')
  })

  it('strips the line reporter cursor/erase codes (ESC[1A / ESC[2K)', () => {
    expect(stripAnsi(`${E}[1A${E}[2K  1 passed (5.4s)`)).toBe('  1 passed (5.4s)')
  })

  it('keeps literal bracketed text like [1/1]', () => {
    expect(stripAnsi('[1/1] [chromium] > e2e/auth.spec.ts:39:1')).toBe('[1/1] [chromium] > e2e/auth.spec.ts:39:1')
  })

  it('leaves plain text unchanged', () => {
    expect(stripAnsi('no codes here')).toBe('no codes here')
  })
})
