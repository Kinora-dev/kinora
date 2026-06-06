import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { AuthType } from '../lib/auth'
import { auth } from '../lib/auth'

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({ headers: req.headers })
  const user = (session?.user as AuthType['user']) ?? null
  return { user, req }
}

export type Context = Awaited<ReturnType<typeof createContext>>
