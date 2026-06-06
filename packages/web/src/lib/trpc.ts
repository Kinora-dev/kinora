import type { AppRouter } from '@kinora/server'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { env } from '@/lib/env'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.serverUrl}/trpc`,
      fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
    }),
  ],
})
