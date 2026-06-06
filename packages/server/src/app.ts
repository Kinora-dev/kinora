import { serveStatic } from '@hono/node-server/serve-static'
import { trpcServer } from '@hono/trpc-server'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { db } from './db'
import { auth } from './lib/auth'
import { env } from './lib/env'
import { getTrustedOrigins } from './lib/utils'
import { publicApi } from './public-api/index'
import { appRouter } from './router/index'
import { createContext } from './trpc/context'

const app = new Hono()

// Public artifacts (trace.zip etc): permissive CORS + range. Registered before
// secureHeaders/global-cors so its CORP doesn't block the viewer's cross-origin
// service-worker fetch. serveStatic ends the chain when the file exists.
app.use('/artifacts/*', cors({ origin: '*' }))
app.use('/artifacts/*', serveStatic({
  root: env.STORAGE_DIR,
  rewriteRequestPath: path => path.replace(/^\/artifacts/, ''),
}))

// API consumed cross-origin (web + viewer). CORP same-origin / HSTS https-upgrade
// would block or break the dev fetches; CORS governs access instead.
app.use(secureHeaders({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  strictTransportSecurity: env.NODE_ENV === 'production' ? 'max-age=15552000; includeSubDomains' : false,
}))
app.use('*', cors({ origin: getTrustedOrigins(), credentials: true }))

app.get('/healthcheck', async (c) => {
  try {
    await db.execute(sql`SELECT 1`)
    return c.json({ status: 'ok' })
  }
  catch {
    return c.json({ status: 'error', message: 'database unreachable' }, 503)
  }
})

app.on(['POST', 'GET'], '/api/auth/*', c => auth.handler(c.req.raw))

// Dashboard API (session-authed, tRPC for shared types with web).
app.use('/trpc/*', trpcServer({ router: appRouter, createContext }))

// Public ingest API (api-key authed, plain REST) - the reporter / cli upload here.
app.route('/api/v1', publicApi)

export { app }
