<script setup lang="ts">
import { cn } from '@playbackhq/ui'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { actionStatus, actionTitle } from '../lib/action'
import { useTraceStore } from '../store'

const store = useTraceStore()

const bounds = computed(() => {
  const m = store.model.value
  if (!m)
    return { min: 0, span: 1 }
  const min = m.startTime
  const span = Math.max(1, m.endTime - m.startTime)
  return { min, span }
})

const segments = computed(() =>
  store.items.value.map((item) => {
    const a = item.action
    const start = a.startTime ?? bounds.value.min
    const end = a.endTime ?? start
    const left = ((start - bounds.value.min) / bounds.value.span) * 100
    const width = Math.max(0.4, ((end - start) / bounds.value.span) * 100)
    return { id: item.id, left, width, status: actionStatus(a) }
  }),
)

const statusColor: Record<string, string> = {
  ok: 'bg-pass/70 hover:bg-pass',
  error: 'bg-fail hover:bg-fail',
  step: 'bg-muted-foreground/40 hover:bg-muted-foreground/70',
}

const currentTitle = computed(() =>
  store.selectedAction.value ? actionTitle(store.selectedAction.value) : 'No action selected',
)
const position = computed(() => `${store.selectedIndex.value + 1} / ${store.items.value.length}`)
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-11 shrink-0 items-center gap-3 px-3">
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          :disabled="store.selectedIndex.value <= 0"
          title="Previous action"
          @click="store.step(-1)"
        >
          <ChevronLeft class="size-4" />
        </button>
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          :disabled="store.selectedIndex.value >= store.items.value.length - 1"
          title="Next action"
          @click="store.step(1)"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
      <div class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {{ currentTitle }}
      </div>
      <div class="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {{ position }}
      </div>
    </div>

    <div class="relative h-7 shrink-0 border-t border-border bg-muted/20">
      <div class="absolute inset-x-2 inset-y-1.5">
        <button
          v-for="seg in segments"
          :key="seg.id"
          type="button"
          :class="cn(
            'absolute top-0 h-full rounded-sm transition-all',
            statusColor[seg.status],
            store.selectedId.value === seg.id && 'ring-2 ring-signal ring-offset-1 ring-offset-background z-10',
          )"
          :style="{ left: `${seg.left}%`, width: `${seg.width}%` }"
          @click="store.select(seg.id)"
        />
      </div>
    </div>
  </div>
</template>
