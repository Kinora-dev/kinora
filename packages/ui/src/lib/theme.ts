import { useColorMode } from '@vueuse/core'

export type ColorMode = 'auto' | 'light' | 'dark'

// Shared across kinora frontends. Same storageKey + same origin (prod) means
// the dashboard and the trace viewer stay in sync (light/dark/system).
export const colorMode = useColorMode({ emitAuto: true, storageKey: 'kinora-theme' })
