import { describe, expect, it } from 'vitest'
import { assertPublicUrl, ipBlocked } from '../src/lib/ssrf'

describe('ipBlocked', () => {
  it('blocks private, loopback, link-local and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fc00::1', 'fd12::1', '::ffff:10.0.0.1'])
      expect(ipBlocked(ip), ip).toBe(true)
  })

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'])
      expect(ipBlocked(ip), ip).toBe(false)
  })
})

describe('assertPublicUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow('http(s)')
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow('http(s)')
  })

  it('rejects private/metadata IP literals', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('not allowed')
    await expect(assertPublicUrl('http://127.0.0.1:3000')).rejects.toThrow('not allowed')
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow('not allowed')
  })

  it('rejects garbage', async () => {
    await expect(assertPublicUrl('not a url')).rejects.toThrow('Invalid URL')
  })
})
