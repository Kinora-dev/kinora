import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'

interface Bucket { count: number, resetAt: number }

interface RateLimitOptions {
  windowMs: number
  limit: number
  key?: (c: Context) => string
}

// Behind a reverse proxy the client IP is the leftmost X-Forwarded-For hop; fall back to the socket.
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff)
    return xff.split(',')[0].trim()
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  }
  catch {
    return 'unknown'
  }
}

// Fixed-window, in-memory. Single-process scope (one VPS); pair with nginx limit_req if scaled out.
export function rateLimit({ windowMs, limit, key = clientIp }: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>()
  return async (c, next) => {
    const now = Date.now()
    const k = key(c)
    let b = buckets.get(k)
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs }
      buckets.set(k, b)
    }
    b.count++
    if (buckets.size > 50_000) {
      for (const [bk, bv] of buckets) {
        if (now >= bv.resetAt)
          buckets.delete(bk)
      }
    }
    if (b.count > limit) {
      c.header('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)))
      return c.json({ error: 'Too many requests' }, 429)
    }
    return next()
  }
}
