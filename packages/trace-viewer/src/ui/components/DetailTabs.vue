<script setup lang="ts">
import { eventsForAction } from '@isomorphic/trace/traceModel'
import { computed, ref } from 'vue'
import { cn } from '../lib/cn'
import { useTraceStore } from '../store'
import ConsoleView from './ConsoleView.vue'
import ErrorsView from './ErrorsView.vue'
import SourceView from './SourceView.vue'

const store = useTraceStore()
type Tab = 'source' | 'errors' | 'console'
const active = ref<Tab>('source')

const errorCount = computed(() => store.model.value?.errorDescriptors.length ?? 0)
const consoleCount = computed(() => {
  const action = store.selectedAction.value
  if (!action)
    return 0
  return eventsForAction(action).filter(e => e.type === 'console').length
})

const tabs = computed<{ id: Tab, label: string, count?: number }[]>(() => [
  { id: 'source', label: 'Source' },
  { id: 'errors', label: 'Errors', count: errorCount.value },
  { id: 'console', label: 'Console', count: consoleCount.value },
])
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        :class="cn(
          'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
          active === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )"
        @click="active = t.id"
      >
        {{ t.label }}
        <span
          v-if="t.count"
          :class="cn(
            'rounded-full px-1.5 text-[10px] tabular-nums',
            t.id === 'errors' ? 'bg-fail/20 text-fail' : 'bg-muted text-muted-foreground',
          )"
        >{{ t.count }}</span>
        <span
          v-if="active === t.id"
          class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-signal"
        />
      </button>
    </div>
    <div class="min-h-0 flex-1">
      <SourceView v-if="active === 'source'" />
      <ErrorsView v-else-if="active === 'errors'" />
      <ConsoleView v-else />
    </div>
  </div>
</template>
