<script setup lang="ts">
import type { PwTestStatus } from '@playbackhq/core'
import { formatDuration, formatPct, passRate } from '@playbackhq/core'
import { useRouteQuery } from '@vueuse/router'
import { ArrowLeft, ExternalLink, GitBranch, Paperclip } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StatBlock from '@/components/viz/StatBlock.vue'
import TestStatusBadge from '@/components/viz/TestStatusBadge.vue'
import { useManifest, useRun } from '@/composables/queries'

const props = defineProps<{ projectId: string, runId: string }>()

const { state: report, isLoading, error } = useRun(props.projectId, props.runId)
const { state: manifest } = useManifest()

const projectName = computed(
  () => manifest.value?.projects.find(p => p.id === props.projectId)?.name ?? props.projectId,
)

const filter = useRouteQuery<'all' | PwTestStatus>('status', 'all')
const search = useRouteQuery('q', '')

const tests = computed(() => report.value?.tests ?? [])
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return tests.value.filter((t) => {
    if (filter.value !== 'all' && t.status !== filter.value)
      return false
    if (q && !t.titlePath.join(' ').toLowerCase().includes(q) && !t.file.toLowerCase().includes(q))
      return false
    return true
  })
})

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
      :to="{ name: 'project', params: { projectId } }"
      class="flex w-fit items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3.5" /> {{ projectName }}
    </RouterLink>

    <div v-if="error" class="rounded-lg border border-fail/30 bg-fail/5 px-5 py-4 font-mono text-sm text-fail">
      {{ String(error) }}
    </div>
    <template v-else-if="isLoading || !report">
      <Skeleton class="h-28 rounded-xl" />
      <Skeleton class="h-96 rounded-xl" />
    </template>

    <template v-else>
      <!-- Header -->
      <div class="flex flex-col gap-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="font-mono text-xl font-semibold tracking-tight">
              {{ report.runId }}
            </h1>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
              <span>{{ dateFmt.format(new Date(report.startedAt)) }}</span>
              <span v-if="report.meta.git?.branch" class="flex items-center gap-1">
                <GitBranch class="size-3" />{{ report.meta.git.branch }}
                <span v-if="report.meta.git.sha">@ {{ report.meta.git.sha }}</span>
              </span>
              <span v-if="report.meta.playwrightVersion">playwright {{ report.meta.playwrightVersion }}</span>
            </div>
          </div>

          <Button
            v-if="report.meta.ci?.runUrl"
            as-child
            variant="outline"
            size="sm"
            class="shrink-0 font-mono text-xs text-muted-foreground"
          >
            <a :href="report.meta.ci.runUrl" target="_blank" rel="noreferrer">
              <ExternalLink class="size-3.5" />
              {{ report.meta.ci.provider ?? 'CI' }}<span v-if="report.meta.ci.runNumber"> #{{ report.meta.ci.runNumber }}</span>
            </a>
          </Button>
        </div>

        <div class="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-border/70 bg-card/80 px-6 py-5">
          <StatBlock
            label="Pass rate" :value="formatPct(passRate(report.counts))"
            :tone="report.counts.unexpected ? 'fail' : report.counts.flaky ? 'flaky' : 'pass'"
          />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Total" :value="report.counts.total" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Failed" :value="report.counts.unexpected" :tone="report.counts.unexpected ? 'fail' : 'default'" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Flaky" :value="report.counts.flaky" :tone="report.counts.flaky ? 'flaky' : 'default'" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Skipped" :value="report.counts.skipped" />
          <Separator orientation="vertical" class="h-10" />
          <StatBlock label="Duration" :value="formatDuration(report.duration)" />
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Tabs v-model="filter">
          <TabsList class="font-mono">
            <TabsTrigger value="all">
              All
            </TabsTrigger>
            <TabsTrigger value="unexpected" class="data-[state=active]:text-fail">
              Failing
            </TabsTrigger>
            <TabsTrigger value="flaky" class="data-[state=active]:text-flaky">
              Flaky
            </TabsTrigger>
            <TabsTrigger value="skipped">
              Skipped
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input v-model="search" placeholder="Filter by title or file..." class="h-9 w-64 font-mono text-xs" />
      </div>

      <!-- Tests -->
      <div class="flex flex-col gap-2">
        <div
          v-for="t in filtered"
          :key="t.testKey"
          class="rounded-lg border border-border/70 bg-card/80 px-4 py-3 transition-colors hover:border-border"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <TestStatusBadge :status="t.status" />
                <span
                  v-for="tag in t.tags"
                  :key="tag"
                  class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >{{ tag }}</span>
              </div>
              <RouterLink
                :to="{ name: 'test', params: { projectId }, query: { key: t.testKey } }"
                class="mt-1.5 block truncate text-sm font-medium hover:underline"
              >
                {{ t.titlePath.join(' › ') }}
              </RouterLink>
              <div class="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {{ t.file }}:{{ t.line }} &middot; {{ t.projectName }}
              </div>
            </div>
            <div class="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              <div class="tabular-nums">
                {{ formatDuration(t.duration) }}
              </div>
              <div v-if="t.retries" class="tabular-nums text-flaky">
                {{ t.retries }} retry
              </div>
            </div>
          </div>

          <!-- Error + attachments -->
          <div v-if="t.errors.length" class="mt-3 overflow-x-auto rounded-md bg-fail/5 p-3">
            <pre class="font-mono text-[11px] leading-relaxed text-fail">{{ t.errors[0].message }}</pre>
          </div>
          <div v-if="t.attachments.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="a in t.attachments"
              :key="a.name"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              <Paperclip class="size-3" />{{ a.name }}
            </span>
          </div>
        </div>

        <div v-if="!filtered.length" class="py-12 text-center font-mono text-sm text-muted-foreground">
          No tests match this filter.
        </div>
      </div>
    </template>
  </div>
</template>
