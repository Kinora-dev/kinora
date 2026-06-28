import { createMiddleware } from 'hono/factory'
import { logger } from './logger'
import { clientIp } from './rate-limit'

// Access log for the non-tRPC REST surfaces (tRPC logs per-procedure in trpc/index.ts).
// Returned error responses (401/404/413/429) are logged here; uncaught throws are logged by app.onError.
export const accessLog = createMiddleware(async (c, next) => {
  const start = Date.now()
  await next()
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
    ip: clientIp(c),
  }, 'request')
})
