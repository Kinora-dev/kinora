import type { Counts, ProjectEntry, RunSummary } from '@/contracts/playback'
import { describe, expect, it } from 'vitest'
import { collectBranches, collectTags, denom, filterRuns, passRate, runHealth } from './aggregate'

function counts(o: Partial<Counts>): Counts {
  return { total: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0, ...o }
}

function makeRun(over: Partial<RunSummary> & { runId: string }): RunSummary {
  return {
    projectId: 'p',
    startedAt: '2026-01-01T00:00:00Z',
    duration: 0,
    counts: counts({ total: 10, expected: 10 }),
    countsByTag: {},
    reportPath: 'x',
    ...over,
  }
}

describe('passRate / denom', () => {
  it('counts flaky as pass and excludes skipped from the denominator', () => {
    const c = counts({ total: 10, expected: 7, flaky: 1, unexpected: 1, skipped: 1 })
    expect(denom(c)).toBe(9)
    expect(passRate(c)).toBeCloseTo(8 / 9)
  })

  it('is 1 when nothing executed', () => {
    expect(passRate(counts({ total: 3, skipped: 3 }))).toBe(1)
  })
})

describe('runHealth', () => {
  it('is failing with any unexpected', () => {
    expect(runHealth(counts({ total: 5, expected: 4, unexpected: 1 }))).toBe('failing')
  })
  it('is flaky with flaky but no unexpected', () => {
    expect(runHealth(counts({ total: 5, expected: 4, flaky: 1 }))).toBe('flaky')
  })
  it('is passing when all expected', () => {
    expect(runHealth(counts({ total: 5, expected: 5 }))).toBe('passing')
  })
  it('is empty with no tests', () => {
    expect(runHealth(counts({}))).toBe('empty')
  })
})

describe('filterRuns', () => {
  const runs = [
    makeRun({ runId: 'a', git: { branch: 'main' }, countsByTag: { '@smoke': counts({ total: 2, expected: 2 }) } }),
    makeRun({ runId: 'b', git: { branch: 'develop' }, countsByTag: {} }),
  ]

  it('filters by branch', () => {
    expect(filterRuns(runs, 'main', null).map(r => r.runId)).toEqual(['a'])
  })

  it('swaps counts for the tag subset and drops runs without the tag', () => {
    const tagged = filterRuns(runs, null, '@smoke')
    expect(tagged.map(r => r.runId)).toEqual(['a'])
    expect(tagged[0].counts).toEqual(counts({ total: 2, expected: 2 }))
  })

  it('returns all runs when no filter', () => {
    expect(filterRuns(runs, null, null)).toHaveLength(2)
  })
})

describe('collectBranches / collectTags', () => {
  const project: ProjectEntry = {
    id: 'p',
    name: 'P',
    runs: [
      makeRun({ runId: 'a', git: { branch: 'main' }, countsByTag: { '@smoke': counts({ total: 1 }) } }),
      makeRun({ runId: 'b', git: { branch: 'develop' }, countsByTag: { '@critical': counts({ total: 1 }) } }),
    ],
  }

  it('collects unique sorted branches', () => {
    expect(collectBranches([project])).toEqual(['develop', 'main'])
  })

  it('collects unique sorted tags', () => {
    expect(collectTags([project])).toEqual(['@critical', '@smoke'])
  })
})
