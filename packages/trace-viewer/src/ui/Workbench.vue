<script setup lang="ts">
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@kinora/ui/resizable'
import { ThemeToggle } from '@kinora/ui/theme-toggle'
import { TooltipProvider } from '@kinora/ui/tooltip'
import { useStorage } from '@vueuse/core'
import { Loader2 } from 'lucide-vue-next'
import { onMounted } from 'vue'
import ActionsList from './components/ActionsList.vue'
import DetailTabs from './components/DetailTabs.vue'
import SnapshotPlayer from './components/SnapshotPlayer.vue'
import Timeline from './components/Timeline.vue'
import { useKeyboardNav } from './lib/useKeyboardNav'
import { useTraceStore } from './store'

const store = useTraceStore()

// Persisted panel sizes (percentages).
const cols = useStorage('kinora-tv-cols', [22, 78])
const rows = useStorage('kinora-tv-rows', [62, 38])

useKeyboardNav()

onMounted(() => {
  const param = new URLSearchParams(location.search).get('trace')
  const uri = param ?? new URL('fixtures/demo.zip', location.href).href
  void store.load(uri)
})
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="grid h-full grid-rows-[auto_minmax(0,1fr)] bg-background text-foreground">
      <!-- global top bar -->
      <header class="flex h-11 items-center gap-2.5 border-b border-border px-4">
        <span class="size-2 rounded-full bg-signal" style="animation: rec-pulse 2s ease-in-out infinite" />
        <span class="text-sm font-semibold tracking-tight">kinora</span>
        <span class="font-mono text-[11px] text-muted-foreground">trace</span>
        <span v-if="store.model.value?.title" class="min-w-0 truncate text-xs text-muted-foreground">
          · {{ store.model.value.title }}
        </span>
        <div class="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <!-- loading / error -->
      <div v-if="store.status.value === 'loading' || store.status.value === 'idle'" class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" />
        Loading trace…
      </div>
      <div v-else-if="store.status.value === 'error'" class="flex items-center justify-center p-8">
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
      <ResizablePanelGroup
        v-else
        direction="horizontal"
        @layout="(s: number[]) => (cols = s)"
      >
        <ResizablePanel :default-size="cols[0]" :min-size="14" :max-size="40">
          <ActionsList />
        </ResizablePanel>
        <ResizableHandle with-handle />
        <ResizablePanel :default-size="cols[1]">
          <div class="grid h-full grid-rows-[auto_minmax(0,1fr)]">
            <Timeline />
            <ResizablePanelGroup
              direction="vertical"
              @layout="(s: number[]) => (rows = s)"
            >
              <ResizablePanel :default-size="rows[0]" :min-size="20">
                <SnapshotPlayer />
              </ResizablePanel>
              <ResizableHandle with-handle />
              <ResizablePanel :default-size="rows[1]" :min-size="15">
                <DetailTabs />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </TooltipProvider>
</template>
