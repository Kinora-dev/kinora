import type { AlertPayload } from '../src/alerts/core'
import { describe, expect, it } from 'vitest'
import { shouldFire } from '../src/alerts/core'
import { buildAlertEmail } from '../src/alerts/email'

const PASS = { total: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 }
const FAIL = { total: 1, expected: 0, unexpected: 1, flaky: 0, skipped: 0 }

describe('shouldFire', () => {
  it('always fires regardless of result', () => {
    expect(shouldFire('always', PASS, 0, 0)).toBe(true)
    expect(shouldFire('always', FAIL, 0, 0)).toBe(true)
  })

  it('on-failure fires only when there are unexpected failures', () => {
    expect(shouldFire('on-failure', FAIL, 0, 0)).toBe(true)
    expect(shouldFire('on-failure', PASS, 0, 0)).toBe(false)
  })

  it('on-regression fires only on newly failing or newly flaky', () => {
    expect(shouldFire('on-regression', PASS, 1, 0)).toBe(true)
    expect(shouldFire('on-regression', PASS, 0, 1)).toBe(true)
    expect(shouldFire('on-regression', FAIL, 0, 0)).toBe(false) // failing but not new
  })
})

describe('buildAlertEmail', () => {
  const base: AlertPayload = {
    projectName: 'web-app',
    runUrl: 'https://app.kinora.dev/projects/web-app/runs/r1',
    counts: FAIL,
    newlyFailing: ['login test'],
    newlyFlaky: [],
  }

  it('subject names the project and counts', () => {
    expect(buildAlertEmail(base).subject).toContain('web-app')
    expect(buildAlertEmail(base).subject).toContain('1 failed')
  })

  it('body lists newly failing tests and the run link', () => {
    const { text } = buildAlertEmail(base)
    expect(text).toContain('Newly failing (1): login test')
    expect(text).toContain(base.runUrl)
  })
})
