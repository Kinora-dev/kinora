<script setup lang="ts">
import type { NormTest, ProjectEntry, RunReport } from '@kinora/core'
import { formatPct, passRate } from '@kinora/core'
import { Button } from '@kinora/ui/button'
import { Card } from '@kinora/ui/card'
import { ArrowLeft, Play } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{ project: ProjectEntry, report: RunReport | null, loading: boolean }>()
const emit = defineEmits<{ back: [], viewTrace: [traceUrl: string] }>()

const STATUS = {
  unexpected: { rank: 0, label: 'Failed', dot: 'bg-fail', text: 'text-fail' },
  flaky: { rank: 1, label: 'Flaky', dot: 'bg-flaky', text: 'text-flaky' },
  expected: { rank: 2, label: 'Passed', dot: 'bg-pass', text: 'text-pass' },
  skipped: { rank: 3, label: 'Skipped', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
} as const

function meta(status: NormTest['status']) {
  return STATUS[status] ?? STATUS.skipped
}

function traceUrl(test: NormTest): string | undefined {
  return test.attachments.find(a => a.url && (a.name === 'trace' || a.contentType === 'application/zip'))?.url
}

const tests = computed(() =>
  [...(props.report?.tests ?? [])].sort((a, b) => meta(a.status).rank - meta(b.status).rank),
)
const rate = computed(() => (props.report ? passRate(props.report.counts) : 0))
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="sm" class="h-8 gap-1.5 font-mono text-xs" @click="emit('back')">
        <ArrowLeft class="size-3.5" />
        Projects
      </Button>
    </div>

    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ project.name }}
        </h1>
        <p class="mt-1 font-mono text-xs text-muted-foreground">
          {{ project.id }} · latest run
        </p>
      </div>
      <div v-if="report" class="flex items-center gap-6 font-mono text-sm tabular-nums">
        <span class="text-pass">{{ report.counts.expected }} passed</span>
        <span v-if="report.counts.unexpected" class="text-fail">{{ report.counts.unexpected }} failed</span>
        <span v-if="report.counts.flaky" class="text-flaky">{{ report.counts.flaky }} flaky</span>
        <span class="text-muted-foreground">{{ formatPct(rate) }} pass</span>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center font-mono text-sm text-muted-foreground">
      Loading run…
    </div>
    <p v-else-if="!report || tests.length === 0" class="py-16 text-center font-mono text-sm text-muted-foreground">
      No tests in the latest run.
    </p>
    <Card v-else class="divide-y divide-border/60 p-0">
      <div
        v-for="test in tests"
        :key="test.testKey"
        class="flex items-center gap-3 px-4 py-3"
      >
        <span class="size-1.5 shrink-0 rounded-full" :class="meta(test.status).dot" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm">
            {{ test.title }}
          </p>
          <p class="truncate font-mono text-[11px] text-muted-foreground">
            {{ test.file }}:{{ test.line }} · {{ test.projectName }}
          </p>
        </div>
        <span class="shrink-0 font-mono text-[11px] tracking-wider uppercase" :class="meta(test.status).text">
          {{ meta(test.status).label }}
        </span>
        <Button
          v-if="traceUrl(test)"
          variant="outline"
          size="sm"
          class="h-7 shrink-0 gap-1.5 font-mono text-[11px]"
          @click="emit('viewTrace', traceUrl(test)!)"
        >
          <Play class="size-3" />
          View trace
        </Button>
      </div>
    </Card>
  </div>
</template>
