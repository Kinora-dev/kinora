import { describe, expect, it } from 'vitest'
import { actionInWindow, inWindow, normalizeRange, xToTime } from '../src/ui/lib/timeline'

describe('normalizeRange', () => {
  it('orders the endpoints', () => {
    expect(normalizeRange(8, 3)).toEqual({ start: 3, end: 8 })
    expect(normalizeRange(3, 8)).toEqual({ start: 3, end: 8 })
  })
})

describe('xToTime', () => {
  it('maps a pixel offset to a time within the span', () => {
    expect(xToTime(50, 100, 1000, 200)).toBe(1100)
  })

  it('clamps out-of-range pixels to the edges', () => {
    expect(xToTime(-20, 100, 1000, 200)).toBe(1000)
    expect(xToTime(999, 100, 1000, 200)).toBe(1200)
  })

  it('returns min for a zero-width track', () => {
    expect(xToTime(50, 0, 1000, 200)).toBe(1000)
  })
})

describe('inWindow', () => {
  const range = { start: 10, end: 20 }
  it('includes the bounds and excludes outside', () => {
    expect(inWindow(10, range)).toBe(true)
    expect(inWindow(20, range)).toBe(true)
    expect(inWindow(9.9, range)).toBe(false)
    expect(inWindow(undefined, range)).toBe(false)
  })
})

describe('actionInWindow', () => {
  const range = { start: 10, end: 20 }
  it('keeps actions whose span intersects the window', () => {
    expect(actionInWindow({ startTime: 12, endTime: 15 }, range)).toBe(true)
    expect(actionInWindow({ startTime: 5, endTime: 11 }, range)).toBe(true)
    expect(actionInWindow({ startTime: 19, endTime: 30 }, range)).toBe(true)
  })

  it('drops actions fully outside', () => {
    expect(actionInWindow({ startTime: 1, endTime: 9 }, range)).toBe(false)
    expect(actionInWindow({ startTime: 21, endTime: 25 }, range)).toBe(false)
  })

  it('treats a missing endTime as an instant at startTime', () => {
    expect(actionInWindow({ startTime: 15 }, range)).toBe(true)
    expect(actionInWindow({ startTime: 25 }, range)).toBe(false)
  })
})
