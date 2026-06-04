import { useColorMode } from '@vueuse/core'

export type ColorMode = 'auto' | 'light' | 'dark'

export const colorMode = useColorMode({ emitAuto: true, storageKey: 'playback-theme' })
