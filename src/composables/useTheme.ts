import { useDark, useToggle } from '@vueuse/core'

export const isDark = useDark({ initialValue: 'dark' })
export const toggleTheme = useToggle(isDark)
