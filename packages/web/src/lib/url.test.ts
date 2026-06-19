import { describe, expect, it } from 'vitest'
import { httpsUrl } from './url'

describe('httpsUrl', () => {
  it('returns https urls unchanged', () => {
    expect(httpsUrl('https://github.com/org/repo')).toBe('https://github.com/org/repo')
  })

  it('rejects http and other schemes', () => {
    expect(httpsUrl('http://example.com')).toBeUndefined()
    expect(httpsUrl('javascript:alert(1)')).toBeUndefined()
    expect(httpsUrl('data:text/html,<script>')).toBeUndefined()
    expect(httpsUrl('file:///etc/passwd')).toBeUndefined()
  })

  it('rejects non-urls and empty', () => {
    expect(httpsUrl('not a url')).toBeUndefined()
    expect(httpsUrl('')).toBeUndefined()
    expect(httpsUrl(undefined)).toBeUndefined()
    expect(httpsUrl(null)).toBeUndefined()
  })
})
