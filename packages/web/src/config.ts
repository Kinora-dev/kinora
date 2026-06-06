import { z } from 'zod'

// Runtime config, in priority order:
//  1. window.__KINORA__ injected by a static /config.js (no rebuild needed)
//  2. VITE_KINORA_* at build time
export const runtimeConfigSchema = z.object({
  // kinora server (tRPC API + better-auth). Empty in prod => same origin.
  serverUrl: z.string().default(''),
  title: z.string().default('Kinora'),
  // Where the trace viewer is served. Prod: same origin under /trace/. Dev: the
  // viewer dev server (set via VITE_KINORA_VIEWER_URL or window.__KINORA__).
  viewerBaseUrl: z.string().default(''),
})
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>

declare global {
  interface Window {
    __KINORA__?: unknown
  }
}

function resolveConfig(): RuntimeConfig {
  const injected = runtimeConfigSchema.safeParse(window.__KINORA__ ?? {})
  const base = injected.success ? injected.data : runtimeConfigSchema.parse({})
  const envServer = import.meta.env.VITE_KINORA_SERVER_URL as string | undefined
  const envViewer = import.meta.env.VITE_KINORA_VIEWER_URL as string | undefined
  // Dev: viewer on its own dev server (pnpm dev:viewer), server on :3000. Prod: /trace/ + same origin.
  const defaultViewer = import.meta.env.DEV ? 'http://localhost:5174/' : '/trace/'
  const defaultServer = import.meta.env.DEV ? 'http://localhost:3000' : ''
  return {
    ...base,
    serverUrl: base.serverUrl || envServer || defaultServer,
    viewerBaseUrl: base.viewerBaseUrl || envViewer || defaultViewer,
  }
}

export const config = resolveConfig()
