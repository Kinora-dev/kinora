<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { onMounted } from 'vue'
import ActionsList from './components/ActionsList.vue'
import DetailTabs from './components/DetailTabs.vue'
import SnapshotPlayer from './components/SnapshotPlayer.vue'
import Timeline from './components/Timeline.vue'
import { useTraceStore } from './store'

const store = useTraceStore()

onMounted(() => {
  const param = new URLSearchParams(location.search).get('trace')
  const uri = param ?? new URL('fixtures/test-trace1.zip', location.href).href
  void store.load(uri)
})
</script>

<template>
  <div class="flex h-full flex-col bg-background text-foreground">
    <!-- top bar: brand + timeline -->
    <header class="flex shrink-0 items-stretch border-b border-border">
      <div class="flex w-[300px] shrink-0 items-center gap-2.5 border-r border-border px-4">
        <span class="size-2 rounded-full bg-signal" style="animation: rec-pulse 2s ease-in-out infinite" />
        <span class="text-sm font-semibold tracking-tight">playback</span>
        <span class="font-mono text-[11px] text-muted-foreground">trace</span>
      </div>
      <div class="min-w-0 flex-1">
        <Timeline v-if="store.status.value === 'ready'" />
      </div>
    </header>

    <!-- loading / error -->
    <div v-if="store.status.value === 'loading' || store.status.value === 'idle'" class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" />
      Loading trace…
    </div>
    <div v-else-if="store.status.value === 'error'" class="flex flex-1 items-center justify-center p-8">
      <div class="max-w-md rounded-lg border border-fail/30 bg-fail/5 p-4 text-sm text-fail">
        <div class="mb-1 font-semibold">
          Failed to load trace
        </div>
        <div class="font-mono text-xs text-fail/80">
          {{ store.errorMessage.value }}
        </div>
      </div>
    </div>

    <!-- workbench -->
    <div v-else class="flex min-h-0 flex-1">
      <aside class="w-[300px] shrink-0 border-r border-border">
        <ActionsList />
      </aside>
      <main class="flex min-w-0 flex-1 flex-col">
        <div class="min-h-0 flex-1">
          <SnapshotPlayer />
        </div>
        <div class="h-[38%] min-h-0 shrink-0 border-t border-border">
          <DetailTabs />
        </div>
      </main>
    </div>
  </div>
</template>
