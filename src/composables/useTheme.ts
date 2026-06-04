import { useColorMode } from '@vueuse/core'

export type ColorMode = 'auto' | 'light' | 'dark'

// auto = follow system; persisted to localStorage by useColorMode.
export const colorMode = useColorMode({ emitAuto: true })
