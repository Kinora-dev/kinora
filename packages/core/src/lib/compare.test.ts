import type { NormTest } from '../contracts/kinora'
import { describe, expect, it } from 'vitest'
import { compareRuns } from './compare'

function makeTest(over: Partial<NormTest> & { testKey: string, status: NormTest['status'] }): NormTest {
  return {
    title: over.testKey,
    titlePath: [over.testKey],
    file: 'f.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    ok: over.status !== 'unexpected',
    duration: 100,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
    ...over,
  }
}

function changeOf(deltas: ReturnType<typeof compareRuns>, key: string) {
  return deltas.find(d => d.testKey === key)?.change
}

describe('compareRuns', () => {
  it('classifies each test by base -> head status', () => {
    const base = [
      makeTest({ testKey: 'broken', status: 'expected' }),
      makeTest({ testKey: 'fixed', status: 'unexpected' }),
      makeTest({ testKey: 'newly-flaky', status: 'expected' }),
      makeTest({ testKey: 'still-failing', status: 'unexpected' }),
      makeTest({ testKey: 'unchanged', status: 'expected' }),
      makeTest({ testKey: 'removed', status: 'expected' }),
    ]
    const head = [
      makeTest({ testKey: 'broken', status: 'unexpected' }),
      makeTest({ testKey: 'fixed', status: 'expected' }),
      makeTest({ testKey: 'newly-flaky', status: 'flaky' }),
      makeTest({ testKey: 'still-failing', status: 'unexpected' }),
      makeTest({ testKey: 'unchanged', status: 'expected' }),
      makeTest({ testKey: 'added', status: 'expected' }),
    ]

    const deltas = compareRuns(base, head)
    expect(changeOf(deltas, 'broken')).toBe('broken')
    expect(changeOf(deltas, 'fixed')).toBe('fixed')
    expect(changeOf(deltas, 'newly-flaky')).toBe('newly-flaky')
    expect(changeOf(deltas, 'still-failing')).toBe('still-failing')
    expect(changeOf(deltas, 'unchanged')).toBe('unchanged')
    expect(changeOf(deltas, 'removed')).toBe('removed')
    expect(changeOf(deltas, 'added')).toBe('added')
  })

  it('computes the per-test duration delta (head - base)', () => {
    const base = [makeTest({ testKey: 'K', status: 'expected', duration: 200 })]
    const head = [makeTest({ testKey: 'K', status: 'expected', duration: 500 })]
    expect(compareRuns(base, head)[0].durationDelta).toBe(300)
  })

  it('carries base/head status, null when a side is missing', () => {
    const deltas = compareRuns(
      [makeTest({ testKey: 'gone', status: 'expected' })],
      [makeTest({ testKey: 'new', status: 'flaky' })],
    )
    expect(deltas.find(d => d.testKey === 'gone')).toMatchObject({ baseStatus: 'expected', headStatus: null })
    expect(deltas.find(d => d.testKey === 'new')).toMatchObject({ baseStatus: null, headStatus: 'flaky' })
  })
})
