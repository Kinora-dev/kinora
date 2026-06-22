import { describe, expect, it } from 'vitest'
import { effectiveAttachments } from './attachments'

const trace = { name: 'trace', contentType: 'application/zip', path: '/r/trace.zip' }
const shot = { name: 'screenshot', contentType: 'image/png', path: '/r/s.png' }

describe('effectiveAttachments', () => {
  // on-first-retry + retries: trace on attempt 1, traceless final attempt 2.
  it('surfaces a trace from an earlier attempt when the final attempt has none', () => {
    const results = [
      { attachments: [] },
      { attachments: [trace] },
      { attachments: [shot] },
    ]
    const got = effectiveAttachments(results)
    expect(got).toContain(shot)
    expect(got).toContain(trace)
  })

  it('keeps the final attempt as-is when it already has the trace', () => {
    const results = [{ attachments: [] }, { attachments: [shot, trace] }]
    expect(effectiveAttachments(results)).toEqual([shot, trace])
  })

  it('returns the final attempt untouched when no attempt has a trace', () => {
    const results = [{ attachments: [shot] }, { attachments: [shot] }]
    expect(effectiveAttachments(results)).toEqual([shot])
  })

  it('handles no results', () => {
    expect(effectiveAttachments([])).toEqual([])
  })
})
