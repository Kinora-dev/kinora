import { describe, expect, it } from 'vitest'
import { manifestSchema, runSummarySchema } from './kinora'

describe('runSummarySchema', () => {
  it('defaults countsByTag to an empty object', () => {
    const r = runSummarySchema.parse({
      runId: 'r',
      projectId: 'p',
      startedAt: '2026-01-01T00:00:00Z',
      duration: 0,
      counts: { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
      reportPath: 'x',
    })
    expect(r.countsByTag).toEqual({})
  })
})

describe('manifestSchema', () => {
  it('accepts a minimal valid manifest', () => {
    const ok = manifestSchema.safeParse({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      projects: [],
    })
    expect(ok.success).toBe(true)
  })

  it('rejects an unknown schemaVersion', () => {
    const bad = manifestSchema.safeParse({ schemaVersion: 99, generatedAt: 'x', projects: [] })
    expect(bad.success).toBe(false)
  })
})
