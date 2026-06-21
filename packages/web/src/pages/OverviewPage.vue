<script setup lang="ts">
import {
  collectBranches,
  collectTags,
  denom,
  filterRuns,
  formatPct,
  latestRun,
  runHealth,
} from '@kinora/core'
import { Button } from '@kinora/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kinora/ui/select'
import { Separator } from '@kinora/ui/separator'
import { Skeleton } from '@kinora/ui/skeleton'
import { StatBlock } from '@kinora/ui/stat-block'
import { useRouteQuery } from '@vueuse/router'
import { computed } from 'vue'
import OverviewEmpty from '@/components/project/OverviewEmpty.vue'
import ProjectCard from '@/components/project/ProjectCard.vue'
import { useManifest } from '@/composables/queries'
import { passRateTone } from '@/lib/rate'

const { state: manifest, isLoading, error } = useManifest()

const projects = computed(() => manifest.value?.projects ?? [])
const branches = computed(() => collectBranches(projects.value))
const tags = computed(() => collectTags(projects.value))

const branch = useRouteQuery('branch', 'all')
const tag = useRouteQuery('tag', 'all')
const hasFilters = computed(() => branch.value !== 'all' || tag.value !== 'all')

function clearFilters() {
  branch.value = 'all'
  tag.value = 'all'
}

// Projects with runs filtered (and, for tag, counts swapped). Empty ones drop out.
const displayProjects = computed(() =>
  projects.value
    .map(p => ({
      ...p,
      runs: filterRuns(p.runs, branch.value === 'all' ? null : branch.value, tag.value === 'all' ? null : tag.value),
    }))
    .filter(p => p.runs.length > 0),
)

const stats = computed(() => {
  const latest = displayProjects.value.map(latestRun).filter(r => r != null)
  let pass = 0
  let total = 0
  let tests = 0
  let failing = 0
  for (const r of latest) {
    pass += r.counts.expected + r.counts.flaky
    total += denom(r.counts)
    tests += r.counts.total
    if (runHealth(r.counts) === 'failing')
      failing++
  }
  const runs = displayProjects.value.reduce((s, p) => s + p.runs.length, 0)
  return {
    projects: displayProjects.value.length,
    runs,
    tests,
    failing,
    passRate: total === 0 ? 1 : pass / total,
  }
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Page header (hidden on a brand-new account so the empty state stands alone) -->
    <div v-if="isLoading || error || projects.length" class="flex flex-col gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">
            Test runs overview
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Playwright report history across every project, one strip per run.
          </p>
        </div>

        <!-- Filters -->
        <div v-if="!isLoading && !error" class="flex items-center gap-2">
          <Select v-if="branches.length > 1" v-model="branch">
            <SelectTrigger class="h-9 w-44 font-mono text-xs">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" class="font-mono text-xs">
                All branches
              </SelectItem>
              <SelectItem v-for="b in branches" :key="b" :value="b" class="font-mono text-xs">
                {{ b }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-if="tags.length" v-model="tag">
            <SelectTrigger class="h-9 w-40 font-mono text-xs">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" class="font-mono text-xs">
                All tags
              </SelectItem>
              <SelectItem v-for="t in tags" :key="t" :value="t" class="font-mono text-xs">
                {{ t }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Button v-if="hasFilters" variant="ghost" size="sm" class="h-9 font-mono text-xs" @click="clearFilters">
            Clear
          </Button>
        </div>
      </div>

      <div
        v-if="!isLoading && !error && projects.length"
        class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/80 px-6 py-5"
      >
        <StatBlock label="Projects" :value="stats.projects" />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock
          label="Global pass rate"
          :value="formatPct(stats.passRate)"
          :tone="passRateTone(stats.passRate)"
        />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock :label="tag === 'all' ? 'Tests / latest' : `${tag} / latest`" :value="stats.tests" />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock label="Total runs" :value="stats.runs" />
        <Separator orientation="vertical" class="h-10" />
        <StatBlock label="Failing now" :value="stats.failing" :tone="stats.failing > 0 ? 'fail' : 'pass'" />
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

    <!-- Brand-new account: no projects reporting at all -->
    <OverviewEmpty v-else-if="!projects.length" />

    <!-- Projects exist but the active filters hide them all -->
    <div
      v-else-if="!displayProjects.length"
      class="py-16 text-center font-mono text-sm text-muted-foreground"
    >
      No runs match these filters.
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <ProjectCard v-for="p in displayProjects" :key="p.id" :project="p" />
    </div>
  </div>
</template>
