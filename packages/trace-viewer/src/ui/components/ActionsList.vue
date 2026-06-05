<script setup lang="ts">
import { cn } from '@playbackhq/ui'
import { Check, ChevronRight, Search, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { actionDuration, actionStatus, actionTitle } from '../lib/action'
import { formatMs } from '../lib/format'
import { useTraceStore } from '../store'
import TextTooltip from './TextTooltip.vue'

const store = useTraceStore()
const filter = ref('')

const rows = computed(() => {
  const f = filter.value.trim().toLowerCase()
  return store.items.value
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
    <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Actions</span>
      <span class="font-mono text-[11px] text-muted-foreground/70">{{ store.items.value.length }}</span>
    </div>

    <div class="border-b border-border px-2 py-1.5">
      <div class="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
        <Search class="size-3.5 text-muted-foreground" />
        <input
          v-model="filter"
          placeholder="Filter actions"
          class="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        >
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      <button
        v-for="row in rows"
        :key="row.item.id"
        type="button"
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
          <Check v-if="row.status === 'ok'" class="size-3.5 text-pass" />
          <X v-else-if="row.status === 'error'" class="size-3.5 text-fail" />
          <ChevronRight v-else class="size-3.5 text-muted-foreground" />
        </span>
        <TextTooltip :text="row.title" class="min-w-0 flex-1" />
        <span class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">{{ formatMs(row.duration) }}</span>
      </button>
    </div>
  </div>
</template>
