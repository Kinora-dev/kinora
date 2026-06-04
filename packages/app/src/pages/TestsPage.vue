<script setup lang="ts">
import { byInstability, formatPct, isUnstable } from '@playbackhq/core'
import { useRouteQuery } from '@vueuse/router'
import { ArrowLeft, ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import CopyLinkButton from '@/components/app/CopyLinkButton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import StatBlock from '@/components/viz/StatBlock.vue'
import StatusTimeline from '@/components/viz/StatusTimeline.vue'
import TestStatusBadge from '@/components/viz/TestStatusBadge.vue'
import { useProjectHistory } from '@/composables/queries'

const props = defineProps<{ projectId: string }>()
const { state, isLoading, error } = useProjectHistory(props.projectId)

const project = computed(() => state.value.project)
const histories = computed(() => state.value.histories)

const search = useRouteQuery('q', '')
const unstableOnly = useRouteQuery<string, boolean>('unstable', 'true', {
  transform: {
    get: v => v !== 'false',
    set: v => (v ? 'true' : 'false'),
  },
})

const unstableCount = computed(() => histories.value.filter(isUnstable).length)

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return histories.value
    .filter(h => (unstableOnly.value ? isUnstable(h) : true))
    .filter(
      h =>
        !q
        || h.titlePath.join(' ').toLowerCase().includes(q)
        || h.file.toLowerCase().includes(q),
    )
    .sort(byInstability)
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <RouterLink
      :to="{ name: 'project', params: { projectId } }"
      class="flex w-fit items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3.5" /> {{ project?.name ?? projectId }}
    </RouterLink>

    <div v-if="error" class="rounded-lg border border-fail/30 bg-fail/5 px-5 py-4 font-mono text-sm text-fail">
      {{ String(error) }}
    </div>
    <template v-else-if="isLoading">
      <Skeleton class="h-24 rounded-xl" />
      <Skeleton class="h-96 rounded-xl" />
    </template>

    <template v-else>
      <div class="flex flex-col gap-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">
              Tests
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Per-test history across {{ project?.runs.length ?? 0 }} runs of {{ project?.name }}.
            </p>
          </div>
          <CopyLinkButton class="shrink-0" />
        </div>

        <div class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/80 px-6 py-5">
          <StatBlock label="Tests tracked" :value="histories.length" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Unstable" :value="unstableCount" :tone="unstableCount ? 'flaky' : 'pass'" />
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          class="font-mono text-xs"
          :class="unstableOnly ? 'border-flaky/50 text-flaky' : ''"
          @click="unstableOnly = !unstableOnly"
        >
          {{ unstableOnly ? 'Unstable only' : 'All tests' }}
        </Button>
        <Input v-model="search" placeholder="Filter by title or file..." class="h-9 w-64 font-mono text-xs" />
      </div>

      <!-- List -->
      <div class="flex flex-col gap-2">
        <RouterLink
          v-for="h in rows"
          :key="h.testKey"
          :to="{ name: 'test', params: { projectId }, query: { key: h.testKey } }"
          class="group grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-border/70 bg-card/80 px-4 py-3 transition-colors hover:border-border"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <TestStatusBadge :status="h.lastStatus" />
              <span class="truncate text-sm font-medium">{{ h.titlePath.join(' › ') }}</span>
            </div>
            <div class="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {{ h.file }} · {{ h.projectName }}
            </div>
          </div>

          <div class="flex items-center gap-6">
            <div class="hidden w-40 sm:block">
              <StatusTimeline :points="h.points" :project-id="projectId" :height="18" :link="false" />
            </div>
            <div class="w-14 text-right">
              <div class="font-mono text-sm tabular-nums" :class="h.flaky ? 'text-flaky' : 'text-muted-foreground'">
                {{ formatPct(h.flakyRate) }}
              </div>
              <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                flaky
              </div>
            </div>
            <div class="w-14 text-right">
              <div class="font-mono text-sm tabular-nums" :class="h.failed ? 'text-fail' : 'text-muted-foreground'">
                {{ formatPct(h.failRate) }}
              </div>
              <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                fail
              </div>
            </div>
            <ChevronRight class="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
        </RouterLink>

        <div v-if="!rows.length" class="py-12 text-center font-mono text-sm text-muted-foreground">
          {{ unstableOnly ? 'No unstable tests. All green.' : 'No tests match this filter.' }}
        </div>
      </div>
    </template>
  </div>
</template>
