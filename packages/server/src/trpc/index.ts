import type { Context } from './context'
import { initTRPC, TRPCError } from '@trpc/server'
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
