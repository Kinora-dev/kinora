import type { Entitlements } from '../src/billing/entitlements'
import { describe, expect, it } from 'vitest'
import { ingestCapError } from '../src/billing/entitlements'

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
