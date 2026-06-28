import { createMiddleware } from 'hono/factory'
import { demo } from './env'

// Read-only demo: block the public ingest API entirely (the dashboard uses tRPC, gated separately).
export const blockInDemo = createMiddleware(async (c, next) => {
  if (demo)
    return c.json({ error: 'This is a read-only demo' }, 403)
  return next()
})

// Block auth writes (sign-up/password/delete) but keep reads; the demo auto-sessions so no login is needed.
export const blockAuthWritesInDemo = createMiddleware(async (c, next) => {
  if (demo && c.req.method === 'POST')
    return c.json({ error: 'This is a read-only demo' }, 403)
  return next()
})
