import process from 'node:process'
import { serve } from '@hono/node-server'
import { app } from './app'
import { env } from './lib/env'
import { logger } from './lib/logger'

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`kinora server running on port ${info.port}`)
})

process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
