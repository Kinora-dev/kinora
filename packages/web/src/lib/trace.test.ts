import { describe, expect, it } from 'vitest'
import { traceViewerHref } from '@/lib/trace'

describe('traceViewerHref', () => {
  it('returns undefined when there is no trace attachment', () => {
    expect(traceViewerHref([])).toBeUndefined()
    expect(traceViewerHref([{ name: 'screenshot', contentType: 'image/png', url: 'https://x/s.png' }])).toBeUndefined()
  })

  it('builds a viewer link for a trace attachment, url-encoding the artifact url', () => {
    const artifact = 'https://api.example.com/artifacts/p/r/x.zip?exp=1&sig=abc'
    const href = traceViewerHref([{ name: 'trace', contentType: 'application/zip', url: artifact }])
    expect(href).toContain('?trace=')
    expect(href).toContain(encodeURIComponent(artifact))
  })

  it('matches by application/zip content type, not just the name', () => {
    const href = traceViewerHref([{ name: 'whatever', contentType: 'application/zip', url: 'https://x/y.zip' }])
    expect(href).toContain('?trace=')
  })

  it('ignores a trace attachment with no hosted url', () => {
    expect(traceViewerHref([{ name: 'trace', contentType: 'application/zip' }])).toBeUndefined()
  })
})
