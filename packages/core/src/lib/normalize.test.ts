import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ingestPlaywrightReport } from './normalize'

const raw: unknown = JSON.parse(
  readFileSync(new URL('../__fixtures__/sample-report.json', import.meta.url), 'utf8'),
)

describe('ingestPlaywrightReport', () => {
  const { summary, report } = ingestPlaywrightReport(raw, { projectId: 'web-app', runId: 'r1' })

  it('flattens nested suites into a flat test list', () => {
    expect(report.tests).toHaveLength(5)
  })

  it('carries the run counts from stats', () => {
    expect(report.counts).toEqual({ total: 5, expected: 2, unexpected: 1, flaky: 1, skipped: 1 })
  })

  it('strips attachment bodies but keeps metadata + hasBody flag', () => {
    const fail = report.tests.find(t => t.status === 'unexpected')
    const shot = fail?.attachments.find(a => a.name === 'screenshot')
    const trace = fail?.attachments.find(a => a.name === 'trace')
    expect(shot?.hasBody).toBe(true)
    expect(trace?.path).toBeTruthy()
    expect(trace?.hasBody).toBe(false)
    expect(JSON.stringify(report)).not.toContain('iVBORw0') // base64 gone
  })

  it('builds a stable testKey from file + title path + project', () => {
    const t = report.tests.find(x => x.title === 'login works')
    expect(t?.testKey).toContain('tests/auth.spec.ts')
    expect(t?.testKey).toContain('login works')
    expect(t?.testKey).toContain('chromium')
  })

  it('derives retries from the number of results', () => {
    const flaky = report.tests.find(t => t.status === 'flaky')
    expect(flaky?.retries).toBe(1)
  })

  it('precomputes per-tag counts on the summary', () => {
    expect(summary.countsByTag['@smoke']).toEqual({
      total: 1,
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    })
  })

  it('sets reportPath by convention', () => {
    expect(summary.reportPath).toBe('reports/web-app/r1.json')
  })
})
