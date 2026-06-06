import { z } from 'zod'

// Two ways to point the front at a server, in priority order:
//  1. window.__KINORA__ injected by a static /config.js (no rebuild needed)
//  2. VITE_KINORA_BASE_URL at build time
// Empty baseUrl + dev => mock data.
export const runtimeConfigSchema = z.object({
  baseUrl: z.string().default(''),
  // kinora server (tRPC API + better-auth). Empty in prod => same origin.
  serverUrl: z.string().default(''),
  // 'static': fetch manifest.json + reports/ files. 'rest': fetch /api/* endpoints.
  mode: z.enum(['static', 'rest']).default('static'),
  title: z.string().default('Kinora'),
  // Where the trace viewer is served. Prod: same origin under /trace/. Dev: the
  // viewer dev server (set via VITE_KINORA_VIEWER_URL or window.__KINORA__).
  // Empty here so env/default resolution in resolveConfig applies.
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
  const envBase = import.meta.env.VITE_KINORA_BASE_URL as string | undefined
  const envViewer = import.meta.env.VITE_KINORA_VIEWER_URL as string | undefined
  const envServer = import.meta.env.VITE_KINORA_SERVER_URL as string | undefined
  // Dev: the viewer runs on its own dev server (pnpm dev:viewer). Prod: /trace/.
  const defaultViewer = import.meta.env.DEV ? 'http://localhost:5174/' : '/trace/'
  // Dev: the server runs on :3000 (pnpm --filter @kinora/server dev). Prod: same origin.
  const defaultServer = import.meta.env.DEV ? 'http://localhost:3000' : ''
  return {
    ...base,
    baseUrl: base.baseUrl || envBase || '',
    serverUrl: base.serverUrl || envServer || defaultServer,
    viewerBaseUrl: base.viewerBaseUrl || envViewer || defaultViewer,
  }
}

export const config = resolveConfig()

export const useMock = !config.baseUrl && import.meta.env.DEV
