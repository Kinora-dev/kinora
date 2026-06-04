<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import RunHistoryTable from '@/components/project/RunHistoryTable.vue'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import HealthBadge from '@/components/viz/HealthBadge.vue'
import Sparkline from '@/components/viz/Sparkline.vue'
import StatBlock from '@/components/viz/StatBlock.vue'
import { useManifest } from '@/composables/queries'
import {
  formatPct,
  latestRun,
  passRate,
  runHealth,
  sortedRuns,
  trend,
} from '@/lib/aggregate'

const props = defineProps<{ projectId: string }>()
const { state: manifest, isLoading, error } = useManifest()

const project = computed(() =>
  manifest.value?.projects.find(p => p.id === props.projectId),
)
const runs = computed(() => (project.value ? sortedRuns(project.value) : []))
const latest = computed(() => (project.value ? latestRun(project.value) : undefined))
const series = computed(() => (project.value ? trend(project.value).map(t => t.passRate) : []))
const health = computed(() => (latest.value ? runHealth(latest.value.counts) : 'empty'))
const toneText = computed(() =>
  health.value === 'passing' ? 'text-pass' : health.value === 'flaky' ? 'text-flaky' : 'text-fail',
)
</script>

<template>
  <div class="flex flex-col gap-8">
    <RouterLink
      :to="{ name: 'overview' }"
      class="flex w-fit items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3.5" /> overview
    </RouterLink>

    <div v-if="error" class="rounded-lg border border-fail/30 bg-fail/5 px-5 py-4 font-mono text-sm text-fail">
      {{ String(error) }}
    </div>
    <template v-else-if="isLoading">
      <Skeleton class="h-28 rounded-xl" />
      <Skeleton class="h-96 rounded-xl" />
    </template>
    <div v-else-if="!project" class="text-sm text-muted-foreground">
      Project not found.
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex flex-col gap-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">
              {{ project.name }}
            </h1>
            <p v-if="project.description" class="mt-1 text-sm text-muted-foreground">
              {{ project.description }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <HealthBadge :health="health" />
            <RouterLink
              :to="{ name: 'tests', params: { projectId: project.id } }"
              class="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              Per-test history
              <ArrowRight class="size-3" />
            </RouterLink>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/40 px-6 py-5">
          <StatBlock
            label="Pass rate"
            :value="latest ? formatPct(passRate(latest.counts)) : '-'"
            :tone="health === 'passing' ? 'pass' : health === 'flaky' ? 'flaky' : 'fail'"
          />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Runs" :value="runs.length" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Tests" :value="latest?.counts.total ?? 0" />
          <div class="ml-auto w-40" :class="toneText">
            <Sparkline :values="series" :height="44" :width="160" />
          </div>
        </div>
      </div>

      <!-- Run history -->
      <RunHistoryTable :runs="runs" :project-id="project.id" />
    </template>
  </div>
</template>
