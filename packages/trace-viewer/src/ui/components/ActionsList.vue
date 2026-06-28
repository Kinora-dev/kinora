<script setup lang="ts">
import { cn } from '@kinora/ui'
import { Check, ChevronRight, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { actionDuration, actionStatus, actionTitle } from '../lib/action'
import { formatMs } from '../lib/format'
import { actionInWindow } from '../lib/timeline'
import { useTraceStore } from '../store'
import FilterInput from './FilterInput.vue'
import TextTooltip from './TextTooltip.vue'

const store = useTraceStore()
const filter = ref('')

const filtering = computed(() => filter.value.trim().length > 0)

const rows = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const range = store.timeRange.value
  // While filtering or zoomed, search the full flat list; otherwise follow collapse state.
  const source = f || range ? store.items.value : store.visibleItems.value
  return source
    .filter(item => !range || actionInWindow(item.action, range))
    .map(item => ({
      item,
      title: actionTitle(item.action),
      status: actionStatus(item.action),
      duration: actionDuration(item.action),
    }))
    .filter(r => !f || r.title.toLowerCase().includes(f))
})
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-11 shrink-0 items-center border-b border-border px-3">
      <div class="flex items-baseline gap-2">
        <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Actions</span>
        <span class="font-mono text-[11px] text-muted-foreground/70">{{ store.timeRange.value ? `${rows.length} / ${store.items.value.length}` : store.items.value.length }}</span>
      </div>
    </div>

    <div class="flex h-12 shrink-0 items-center border-b border-border px-2">
      <FilterInput v-model="filter" placeholder="Filter actions" class="w-full" />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      <button
        v-for="row in rows"
        :key="row.item.id"
        type="button"
        data-testid="action"
        :class="cn(
          'group relative flex w-full items-center gap-2 py-1.5 pr-2.5 text-left text-[13px] transition-colors',
          store.selectedId.value === row.item.id
            ? 'bg-signal/10 text-foreground'
            : 'text-foreground/80 hover:bg-muted/50',
        )"
        :style="{ paddingLeft: `${10 + row.item.depth * 14}px` }"
        @click="store.select(row.item.id)"
      >
        <span
          v-if="store.selectedId.value === row.item.id"
          class="absolute inset-y-0 left-0 w-0.5 bg-signal"
        />
        <span class="flex size-4 shrink-0 items-center justify-center">
          <X v-if="row.status === 'error'" class="size-3.5 text-fail" />
          <span
            v-else-if="!filtering && row.item.hasChildren"
            class="flex cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            @click.stop="store.toggleCollapse(row.item.id)"
          >
            <ChevronRight :class="cn('size-3.5 transition-transform', !store.collapsed.value.has(row.item.id) && 'rotate-90')" />
          </span>
          <Check v-else-if="row.status === 'ok'" class="size-3.5 text-pass" />
        </span>
        <TextTooltip :text="row.title" class="min-w-0 flex-1" />
        <span class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">{{ formatMs(row.duration) }}</span>
      </button>
    </div>
  </div>
</template>
