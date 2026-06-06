<script setup lang="ts">
import { formatPct } from '@kinora/core'
import { Separator } from '@kinora/ui/separator'
import { Skeleton } from '@kinora/ui/skeleton'
import { ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CopyLinkButton from '@/components/app/CopyLinkButton.vue'
import StatBlock from '@/components/viz/StatBlock.vue'
import StatusTimeline from '@/components/viz/StatusTimeline.vue'
import TestStatusBadge from '@/components/viz/TestStatusBadge.vue'
import { useProjectHistory } from '@/composables/queries'

const props = defineProps<{ projectId: string }>()
const route = useRoute()
const { state, isLoading, error } = useProjectHistory(props.projectId)

const testKey = computed(() => {
  const k = route.query.key
  return Array.isArray(k) ? (k[0] ?? '') : (k ?? '')
})

const project = computed(() => state.value.project)
const history = computed(() => state.value.histories.find(h => h.testKey === testKey.value))

// Failures and flakes, most recent first.
const incidents = computed(() =>
  history.value
    ? [...history.value.points].reverse().filter(p => p.status === 'unexpected' || p.status === 'flaky')
    : [],
)

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <RouterLink
      :to="{ name: 'tests', params: { projectId } }"
      class="flex w-fit items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3.5" /> {{ project?.name ?? projectId }} tests
    </RouterLink>

    <div v-if="error" class="rounded-lg border border-fail/30 bg-fail/5 px-5 py-4 font-mono text-sm text-fail">
      {{ String(error) }}
    </div>
    <template v-else-if="isLoading">
      <Skeleton class="h-28 rounded-xl" />
      <Skeleton class="h-64 rounded-xl" />
    </template>
    <div v-else-if="!history" class="text-sm text-muted-foreground">
      Test not found in history.
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex flex-col gap-6">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ history.title }}
            </h1>
            <div class="mt-1 font-mono text-xs text-muted-foreground">
              {{ history.titlePath.slice(0, -1).join(' › ') || history.file }}
            </div>
            <div class="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {{ history.file }} · {{ history.projectName }}
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <TestStatusBadge :status="history.lastStatus" />
            <CopyLinkButton />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/80 px-6 py-5">
          <StatBlock label="Runs" :value="history.runs" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock
            label="Pass rate" :value="formatPct(history.passRate)"
            :tone="history.failed ? 'fail' : history.flaky ? 'flaky' : 'pass'"
          />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Flaky rate" :value="formatPct(history.flakyRate)" :tone="history.flaky ? 'flaky' : 'default'" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Fail rate" :value="formatPct(history.failRate)" :tone="history.failed ? 'fail' : 'default'" />
        </div>
      </div>

      <!-- Timeline -->
      <div class="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 px-6 py-5">
        <div class="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Status timeline</span>
          <span>{{ history.runs }} runs · oldest → newest</span>
        </div>
        <StatusTimeline :points="history.points" :project-id="projectId" :height="32" :q="history.title" />
      </div>

      <!-- Incidents -->
      <div class="flex flex-col gap-2">
        <h2 class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Failures & flakes ({{ incidents.length }})
        </h2>
        <RouterLink
          v-for="p in incidents"
          :key="p.runId"
          :to="{ name: 'run', params: { projectId, runId: p.runId }, query: { q: history.title } }"
          class="block rounded-lg border border-border/70 bg-card/80 px-4 py-3 transition-colors hover:border-border"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <TestStatusBadge :status="p.status" />
              <span class="font-mono text-xs text-muted-foreground">{{ dateFmt.format(new Date(p.startedAt)) }}</span>
            </div>
            <span v-if="p.retries" class="font-mono text-[11px] text-flaky">{{ p.retries }} retry</span>
          </div>
          <pre v-if="p.errorMessage" class="mt-2 overflow-x-auto rounded-md bg-fail/5 p-3 font-mono text-[11px] leading-relaxed text-fail">{{ p.errorMessage }}</pre>
        </RouterLink>

        <div v-if="!incidents.length" class="py-8 text-center font-mono text-sm text-pass">
          No failures recorded. Rock solid.
        </div>
      </div>
    </template>
  </div>
</template>
