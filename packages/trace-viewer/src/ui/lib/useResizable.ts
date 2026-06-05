import { useEventListener, useStorage } from '@vueuse/core'
import { ref } from 'vue'

interface Options {
  axis: 'x' | 'y'
  min: number
  max: number
  // Drag toward the panel's leading edge grows it (e.g. a bottom panel resized
  // from its top edge: dragging up should make it taller).
  invert?: boolean
}

export function useResizable(key: string, initial: number, opts: Options) {
  const size = useStorage(`pb-tv-${key}`, initial)
  const dragging = ref(false)

  function start(event: PointerEvent): void {
    event.preventDefault()
    dragging.value = true
    const origin = opts.axis === 'x' ? event.clientX : event.clientY
    const startSize = size.value

    const stopMove = useEventListener(window, 'pointermove', (e: PointerEvent) => {
      const delta = (opts.axis === 'x' ? e.clientX : e.clientY) - origin
      const next = startSize + (opts.invert ? -delta : delta)
      size.value = Math.min(opts.max, Math.max(opts.min, next))
    })
    const stopUp = useEventListener(window, 'pointerup', () => {
      dragging.value = false
      stopMove()
      stopUp()
    })
  }

  return { size, dragging, start }
}
