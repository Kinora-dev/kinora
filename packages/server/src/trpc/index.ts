import type { Context } from './context'
import * as Sentry from '@sentry/node'
import { initTRPC, TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { member } from '../db/schemas/index'
import { demo } from '../lib/env'
import { logger } from '../lib/logger'

export const t = initTRPC.context<Context>().create()

const loggedProcedure = t.procedure.use(async (opts) => {
  // Public demo is browse-only: reject every mutation (one gate for all routers).
  if (demo && opts.type === 'mutation')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This is a read-only demo' })
  const start = Date.now()
  const result = await opts.next()
  const ms = Date.now() - start
  const line = ` ${result.ok ? 'OK' : 'ERROR'} ${opts.type} ${opts.path} - ${ms}ms`
  if (result.ok) {
    logger.info(line)
  }
  else {
    logger.error({ error: result.error.message }, line)
    // Only unexpected failures; expected TRPCErrors (auth, validation) would be noise.
    if (result.error.code === 'INTERNAL_SERVER_ERROR')
      Sentry.captureException(result.error.cause ?? result.error)
  }
  return result
})

export const router = t.router
export const publicProcedure = loggedProcedure

export const authProcedure = loggedProcedure.use(async (opts) => {
  if (!opts.ctx.user)
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  return opts.next({ ctx: { user: opts.ctx.user } })
})

// Most dashboard data is scoped to the session's active organization.
export const orgProcedure = authProcedure.use(async (opts) => {
  if (!opts.ctx.organizationId)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No active organization' })
  return opts.next({ ctx: { organizationId: opts.ctx.organizationId } })
})

// Mutations that change org config (projects, alerts, tokens) need an admin/owner role.
export const adminProcedure = orgProcedure.use(async (opts) => {
  const row = await db.query.member.findFirst({
    where: and(eq(member.userId, opts.ctx.user.id), eq(member.organizationId, opts.ctx.organizationId)),
    columns: { role: true },
  })
  if (row?.role !== 'owner' && row?.role !== 'admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires an admin role' })
  return opts.next()
})
