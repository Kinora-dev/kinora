<script setup lang="ts">
import type { SnapshotTab } from '../lib/snapshots'
import { cn } from '@kinora/ui'
import { Monitor } from 'lucide-vue-next'
import { computed, watch } from 'vue'
import { useTraceStore } from '../store'
import TextTooltip from './TextTooltip.vue'

const store = useTraceStore()

const tabs: { id: SnapshotTab, label: string }[] = [
  { id: 'before', label: 'Before' },
  { id: 'action', label: 'Action' },
  { id: 'after', label: 'After' },
]

const viewport = computed(() => store.snapshotInfo.value.viewport)
const pageUrl = computed(() => store.snapshotInfo.value.url ?? '')
const frameSrc = computed(() => store.currentSnapshotUrl.value ?? 'about:blank')

watch(frameSrc, () => {
  void store.refreshSnapshotInfo()
}, { immediate: true })
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <!-- snapshot tabs + viewport -->
    <div class="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
      <div class="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          :class="cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            store.snapshotTab.value === t.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )"
          @click="store.setTab(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Monitor class="size-3.5" />
        <span v-if="viewport" class="font-mono tabular-nums">{{ viewport.width }}×{{ viewport.height }}</span>
      </div>
    </div>

    <!-- browser chrome + page -->
    <div class="flex min-h-0 flex-1 flex-col p-3">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-black/40">
        <div class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3">
          <div class="flex gap-1.5">
            <span class="size-2.5 rounded-full bg-fail/70" />
            <span class="size-2.5 rounded-full bg-flaky/70" />
            <span class="size-2.5 rounded-full bg-pass/70" />
          </div>
          <div class="ml-1 flex h-5 min-w-0 flex-1 items-center rounded-md border border-border/70 bg-background/60 px-2.5">
            <TextTooltip :text="pageUrl || 'about:blank'" class="font-mono text-[11px] text-muted-foreground" />
          </div>
        </div>
        <div class="relative min-h-0 flex-1 bg-white">
          <iframe
            :src="frameSrc"
            name="snapshot"
            title="DOM snapshot"
            sandbox="allow-same-origin allow-scripts"
            class="absolute inset-0 size-full border-0"
          />
        </div>
      </div>
    </div>
  </div>
</template>
