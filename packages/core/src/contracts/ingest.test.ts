import type { NormTest } from './kinora'
import { describe, expect, it } from 'vitest'
import { ingestRunSchema, MAX_TESTS_PER_RUN } from './ingest'

function normTest(): NormTest {
  return {
    testKey: 'k',
    title: 't',
    titlePath: ['f.ts', 't'],
    file: 'f.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    status: 'expected',
    ok: true,
    duration: 0,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
  }
}

function runWith(count: number) {
  return {
    project: { slug: 's', name: 's' },
    run: { startedAt: '2026-01-01T00:00:00Z', duration: 0, counts: { total: count, expected: count, unexpected: 0, flaky: 0, skipped: 0 } },
    tests: Array.from({ length: count }, normTest),
  }
}

describe('ingestRunSchema tests cap', () => {
  it('accepts a run at the cap', () => {
    expect(ingestRunSchema.safeParse(runWith(MAX_TESTS_PER_RUN)).success).toBe(true)
  })

  it('rejects a run over the cap', () => {
    expect(ingestRunSchema.safeParse(runWith(MAX_TESTS_PER_RUN + 1)).success).toBe(false)
  })
})
