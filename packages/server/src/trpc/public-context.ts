import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

export async function createPublicContext({ req }: FetchCreateContextFnOptions) {
  return { user: null, req }
}

export type PublicContext = Awaited<ReturnType<typeof createPublicContext>>
