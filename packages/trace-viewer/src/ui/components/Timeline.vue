<script setup lang="ts">
import { cn } from '@kinora/ui'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-vue-next'
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

const frames = computed(() => {
  const m = store.model.value
  if (!m)
    return []
  const out: { url: string, left: number, timestamp: number }[] = []
  for (const page of m.pages) {
    for (const f of page.screencastFrames) {
      out.push({
        url: m.createRelativeUrl(`sha1/${f.sha1}`),
        left: ((f.timestamp - bounds.value.min) / bounds.value.span) * 100,
        timestamp: f.timestamp,
      })
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp)
})

const statusColor: Record<string, string> = {
  ok: 'bg-pass/70 hover:bg-pass',
  error: 'bg-fail hover:bg-fail',
  step: 'bg-muted-foreground/40 hover:bg-muted-foreground/70',
}

const currentTitle = computed(() =>
  store.selectedAction.value ? actionTitle(store.selectedAction.value) : 'No action selected',
)
const position = computed(() => `${store.selectedIndex.value + 1} / ${store.items.value.length}`)

// Select the action whose time window is closest to a screencast frame.
function seekToTime(t: number): void {
  let best: string | undefined
  let bestDist = Infinity
  for (const item of store.items.value) {
    const start = item.action.startTime ?? 0
    const dist = Math.abs(start - t)
    if (dist < bestDist) {
      bestDist = dist
      best = item.id
    }
  }
  if (best)
    store.select(best)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
      <button
        type="button"
        data-testid="play"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :title="store.playing.value ? 'Pause' : 'Play'"
        @click="store.togglePlay"
      >
        <Pause v-if="store.playing.value" class="size-4" />
        <Play v-else class="size-4" />
      </button>
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
      <div data-testid="current-action" class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {{ currentTitle }}
      </div>
      <div class="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {{ position }}
      </div>
    </div>

    <!-- filmstrip -->
    <div v-if="frames.length" class="relative h-12 shrink-0 border-b border-border bg-muted/10">
      <div class="absolute inset-x-2 inset-y-1.5">
        <img
          v-for="(f, i) in frames"
          :key="i"
          :src="f.url"
          class="absolute top-0 h-full w-16 cursor-pointer rounded-sm border border-border object-cover object-top transition-transform hover:z-10 hover:scale-110"
          :style="{ left: `${f.left}%` }"
          @click="seekToTime(f.timestamp)"
        >
      </div>
    </div>

    <!-- action track -->
    <div class="relative h-7 shrink-0 bg-muted/20">
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
