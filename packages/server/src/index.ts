/* eslint-disable perfectionist/sort-imports -- ./instrument must load first so Sentry inits before other modules */
import './instrument'
import { serve } from '@hono/node-server'
import process from 'node:process'
import { app } from './app'
import { db } from './db'
import { env } from './lib/env'
import { logger } from './lib/logger'

// Log stray rejections instead of letting one crash the whole server; uncaught exceptions leave the
// process in an undefined state, so exit and let the orchestrator restart cleanly.
process.on('unhandledRejection', reason => logger.error({ reason }, 'unhandled promise rejection'))
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception')
  process.exit(1)
})

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`kinora server running on port ${info.port}`)
})

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown)
    return
  shuttingDown = true
  logger.info({ signal }, 'shutting down')
  // Never hang on a stuck keep-alive connection; the orchestrator SIGKILLs after its grace period anyway.
  setTimeout(() => process.exit(1), 10_000).unref()
  await new Promise<void>(resolve => server.close(() => resolve()))
  await db.$client.end().catch(err => logger.error({ err }, 'pool close failed'))
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
