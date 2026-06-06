import type { AppRouter } from '@kinora/server'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { env } from '@/lib/env'
import { session } from '@/lib/session'
import { router } from '@/router'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.serverUrl}/trpc`,
      fetch: async (url, opts) => {
        const res = await fetch(url, { ...opts, credentials: 'include' })
        // Session expired or revoked mid-app: drop the stale user and bounce to login.
        if (res.status === 401) {
          session.setUser(null)
          if (router.currentRoute.value.name !== 'login')
            void router.push({ name: 'login' })
        }
        return res
      },
    }),
  ],
})
