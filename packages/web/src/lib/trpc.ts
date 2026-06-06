import type { AppRouter } from '@kinora/server'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { config } from '@/config'

// Typed dashboard client. `credentials: include` carries the better-auth session
// cookie cross-origin in dev (web :5173 -> server :3000).
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${config.serverUrl}/trpc`,
      fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
    }),
  ],
})
