import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

function v4Blocked(ip: string): boolean {
  const o = ip.split('.').map(Number)
  if (o.length !== 4 || o.some(n => !Number.isInteger(n) || n < 0 || n > 255))
    return true
  const [a, b] = o
  if (a === 0 || a === 10 || a === 127) // this-network, private, loopback
    return true
  if (a === 169 && b === 254) // link-local + cloud metadata (169.254.169.254)
    return true
  if (a === 172 && b >= 16 && b <= 31) // private
    return true
  if (a === 192 && b === 168) // private
    return true
  if (a === 100 && b >= 64 && b <= 127) // CGNAT
    return true
  if (a === 198 && (b === 18 || b === 19)) // benchmarking
    return true
  if (a >= 224) // multicast + reserved + broadcast
    return true
  return false
}

function v6Blocked(ip: string): boolean {
  const v = ip.toLowerCase().split('%')[0]
  if (v === '::1' || v === '::') // loopback, unspecified
    return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v)
  if (mapped) // IPv4-mapped, judge by the embedded v4
    return v4Blocked(mapped[1])
  const head = v.split(':')[0]
  if (/^fe[89ab]/.test(head)) // fe80::/10 link-local
    return true
  if (head.startsWith('fc') || head.startsWith('fd')) // fc00::/7 unique-local
    return true
  if (head.startsWith('ff')) // ff00::/8 multicast
    return true
  return false
}

export function ipBlocked(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4)
    return v4Blocked(ip)
  if (kind === 6)
    return v6Blocked(ip)
  return true
}

// Reject URLs targeting private/loopback/link-local/metadata addresses before any outbound fetch.
export async function assertPublicUrl(raw: string): Promise<void> {
  let url: URL
  try {
    url = new URL(raw)
  }
  catch {
    throw new Error('Invalid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('URL must use http(s)')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) {
    if (ipBlocked(host))
      throw new Error('URL host is not allowed')
    return
  }
  const addrs = await lookup(host, { all: true })
  if (!addrs.length)
    throw new Error('URL host did not resolve')
  for (const a of addrs) {
    if (ipBlocked(a.address))
      throw new Error('URL host resolves to a private address')
  }
}

// A hung endpoint must not tie up a caller; cap every outbound request.
const OUTBOUND_TIMEOUT_MS = 5000

// Residual DNS-rebinding TOCTOU between lookup and fetch is accepted; redirect:'error' stops a
// public URL from 30x-ing to an internal one.
export const safeFetch: Fetcher = async (url, init) => {
  await assertPublicUrl(url)
  return globalThis.fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) })
}
