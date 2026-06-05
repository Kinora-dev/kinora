import { useActiveElement, useMagicKeys, whenever } from '@vueuse/core'
import { useTraceStore } from '../store'

export function useKeyboardNav(): void {
  const store = useTraceStore()
  const active = useActiveElement()

  function typing(): boolean {
    const el = active.value as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }

  const keys = useMagicKeys()
  const next = (): void => {
    if (!typing())
      store.step(1)
  }
  const prev = (): void => {
    if (!typing())
      store.step(-1)
  }

  whenever(keys.ArrowDown!, next)
  whenever(keys.j!, next)
  whenever(keys.ArrowUp!, prev)
  whenever(keys.k!, prev)
}
