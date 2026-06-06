import type { AppRouter } from '@kinora/server'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { config } from '@/config'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${config.serverUrl}/trpc`,
      fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
    }),
  ],
})
