import { z } from 'zod'

// Two ways to point the front at a server, in priority order:
//  1. window.__PLAYBACK__ injected by a static /config.js (no rebuild needed)
//  2. VITE_PLAYBACK_BASE_URL at build time
// Empty baseUrl + dev => mock data.
export const runtimeConfigSchema = z.object({
  baseUrl: z.string().default(''),
  title: z.string().default('Playback'),
})
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>

declare global {
  interface Window {
    __PLAYBACK__?: unknown
  }
}

function resolveConfig(): RuntimeConfig {
  const injected = runtimeConfigSchema.safeParse(window.__PLAYBACK__ ?? {})
  const base = injected.success ? injected.data : runtimeConfigSchema.parse({})
  const envBase = import.meta.env.VITE_PLAYBACK_BASE_URL as string | undefined
  return {
    ...base,
    baseUrl: base.baseUrl || envBase || '',
  }
}

export const config = resolveConfig()

export const useMock = !config.baseUrl && import.meta.env.DEV
