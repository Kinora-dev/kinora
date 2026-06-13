import type { Entitlements } from '../src/billing/entitlements'
import { describe, expect, it } from 'vitest'
import { ingestCapError, quotaCrossing, quotaWarningText } from '../src/billing/entitlements'

const free: Entitlements = { tier: 'free', includedResults: 2500, maxProjects: 1, retentionDays: 7, alerts: false }
const selfhost: Entitlements = { tier: 'selfhost', includedResults: Infinity, maxProjects: Infinity, retentionDays: Infinity, alerts: true }

describe('ingestCapError', () => {
  it('blocks free tier once the monthly result limit is reached', () => {
    expect(ingestCapError(free, 2499, false, 0)).toBeNull()
    expect(ingestCapError(free, 2500, false, 0)).toEqual({ error: expect.stringContaining('monthly'), limit: 2500 })
  })

  it('blocks creating a new project beyond the limit, but not ingesting into an existing one', () => {
    const e = { ...free, includedResults: Infinity } // isolate the project cap
    expect(ingestCapError(e, 0, true, 1)).toEqual({ error: expect.stringContaining('project'), limit: 1 })
    expect(ingestCapError(e, 0, true, 0)).toBeNull() // under the limit
    expect(ingestCapError(e, 0, false, 5)).toBeNull() // existing project: never blocked
  })

  it('never caps an unlimited tier', () => {
    expect(ingestCapError(selfhost, 1e9, true, 1e9)).toBeNull()
  })

  it('the result cap only applies to free, not paid tiers', () => {
    const team: Entitlements = { tier: 'team', includedResults: 10_000, maxProjects: Infinity, retentionDays: 90, alerts: true }
    // Team is metered (overage billed), never hard-capped on results.
    expect(ingestCapError(team, 999_999, false, 0)).toBeNull()
  })
})

describe('quotaCrossing', () => {
  const LIMIT = 2500 // near = 2000

  it('flags the ingest that crosses 80%', () => {
    expect(quotaCrossing(1990, 2010, LIMIT)).toBe('near')
    expect(quotaCrossing(1999, 2000, LIMIT)).toBe('near')
  })

  it('flags the ingest that crosses 100%', () => {
    expect(quotaCrossing(2490, 2510, LIMIT)).toBe('reached')
    expect(quotaCrossing(2499, 2500, LIMIT)).toBe('reached')
  })

  it('prefers reached when a single ingest blows past both thresholds', () => {
    expect(quotaCrossing(10, 3000, LIMIT)).toBe('reached')
  })

  it('returns null when no threshold is crossed', () => {
    expect(quotaCrossing(100, 200, LIMIT)).toBeNull() // below near
    expect(quotaCrossing(2100, 2200, LIMIT)).toBeNull() // already past near, below limit
    expect(quotaCrossing(2600, 2700, LIMIT)).toBeNull() // already over (cap rejects anyway)
  })
})

describe('quotaWarningText', () => {
  it('reached: states the limit and an upgrade link', () => {
    const text = quotaWarningText('Joris', 'reached', 2510, 2500, 'https://app.kinora.dev')
    expect(text).toContain('hit its monthly free limit of 2,500')
    expect(text).toContain('https://app.kinora.dev')
  })

  it('near: states usage out of the limit', () => {
    expect(quotaWarningText(null, 'near', 2000, 2500, 'x')).toContain('2,000 of its 2,500')
  })
})
