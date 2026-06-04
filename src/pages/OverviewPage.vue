<script setup lang="ts">
import { computed } from 'vue'
import { useManifest } from '@/composables/queries'
import ProjectCard from '@/components/project/ProjectCard.vue'
import StatBlock from '@/components/viz/StatBlock.vue'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { denom, latestRun, runHealth, formatPct } from '@/lib/aggregate'

const { state: manifest, isLoading, error } = useManifest()

const projects = computed(() => manifest.value?.projects ?? [])

const stats = computed(() => {
  const latest = projects.value.map(latestRun).filter((r) => r != null)
  let pass = 0
  let total = 0
  let tests = 0
  let failing = 0
  for (const r of latest) {
    pass += r.counts.expected + r.counts.flaky
    total += denom(r.counts)
    tests += r.counts.total
    if (runHealth(r.counts) === 'failing') failing++
  }
  const runs = projects.value.reduce((s, p) => s + p.runs.length, 0)
  return {
    projects: projects.value.length,
    runs,
    tests,
    failing,
    passRate: total === 0 ? 1 : pass / total,
  }
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Page header -->
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Test runs overview</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Playwright report history across every project, one strip per run.
        </p>
      </div>

      <div
        v-if="!isLoading && !error"
        class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/40 px-6 py-5"
      >
        <StatBlock label="Projects" :value="stats.projects" />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock
          label="Global pass rate"
          :value="formatPct(stats.passRate)"
          :tone="stats.passRate >= 0.99 ? 'pass' : stats.passRate >= 0.9 ? 'flaky' : 'fail'"
        />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock label="Tests / latest" :value="stats.tests" />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock label="Total runs" :value="stats.runs" />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock
          label="Failing now"
          :value="stats.failing"
          :tone="stats.failing > 0 ? 'fail' : 'pass'"
        />
      </div>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="rounded-lg border border-fail/30 bg-fail/5 px-5 py-4 font-mono text-sm text-fail"
    >
      Failed to load manifest: {{ String(error) }}
    </div>

    <!-- Loading -->
    <div v-else-if="isLoading" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-64 rounded-xl" />
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <ProjectCard v-for="p in projects" :key="p.id" :project="p" />
    </div>
  </div>
</template>
