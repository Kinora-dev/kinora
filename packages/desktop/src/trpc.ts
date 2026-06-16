import type { AppRouter } from '@kinora/server'
import { createTRPCClient, httpBatchLink } from '@trpc/client'

// Typed dashboard client, run from the main process (Node fetch, no CORS). The session
// token rides as Authorization: Bearer; Origin keeps better-auth's guard happy.
export function makeTrpc(serverUrl: string, token: string, origin: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${serverUrl}/trpc`,
        fetch: (url, opts) => fetch(url, {
          ...opts,
          headers: {
            ...(opts?.headers as Record<string, string> | undefined),
            Authorization: `Bearer ${token}`,
            Origin: origin,
          },
        }),
      }),
    ],
  })
}
