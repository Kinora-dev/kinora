import type { Context } from './context'
import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '../lib/auth'
import { logger } from '../lib/logger'

export const t = initTRPC.context<Context>().create()

const loggedProcedure = t.procedure.use(async (opts) => {
  const start = Date.now()
  const result = await opts.next()
  const ms = Date.now() - start
  const line = ` ${result.ok ? 'OK' : 'ERROR'} ${opts.type} ${opts.path} - ${ms}ms`
  if (result.ok)
    logger.info(line)
  else
    logger.error({ error: result.error.message }, line)
  return result
})

export const router = t.router
export const publicProcedure = loggedProcedure

export const authProcedure = loggedProcedure.use(async (opts) => {
  if (!opts.ctx.user)
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  return opts.next({ ctx: { user: opts.ctx.user } })
})

const BEARER_PREFIX = 'Bearer '

// API-key auth for the public ingest API (reporter sends a token).
// better-auth's apiKey referenceId defaults to the owning userId.
export const apiKeyProcedure = loggedProcedure.use(async (opts) => {
  const header = opts.ctx.req.headers.get('Authorization')
  if (!header?.startsWith(BEARER_PREFIX))
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' })

  const key = header.slice(BEARER_PREFIX.length).trim()
  const verification = await auth.api.verifyApiKey({ body: { key } })
  if (!verification.valid || !verification.key)
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid API key' })

  return opts.next({ ctx: { userId: verification.key.referenceId } })
})
