import { trpcServer } from '@hono/trpc-server'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db } from './db'
import { auth } from './lib/auth'
import { getTrustedOrigins } from './lib/utils'
import { publicApiRouter } from './public-router/index'
import { appRouter } from './router/index'
import { createContext } from './trpc/context'
import { createPublicContext } from './trpc/public-context'

const app = new Hono()

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

// Dashboard API (session-authed).
app.use('/trpc/*', trpcServer({ router: appRouter, createContext }))

// Public ingest API (api-key authed) - the reporter uploads here.
app.use('/api/v1/*', trpcServer({ router: publicApiRouter, createContext: createPublicContext }))

export { app }
