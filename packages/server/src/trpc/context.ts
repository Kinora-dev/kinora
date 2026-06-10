import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { AuthType } from '../lib/auth'
import { auth } from '../lib/auth'

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({ headers: req.headers })
  const user = (session?.user as AuthType['user']) ?? null
  const organizationId = (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId ?? null
  return { user, organizationId, req }
}

export type Context = Awaited<ReturnType<typeof createContext>>
