<script setup lang="ts">
import type { NormTest, ProjectEntry, RunComparison, RunReport, TestHistory } from '@kinora/core'
import { formatPct, passRate } from '@kinora/core'
import { Button } from '@kinora/ui/button'
import { Card } from '@kinora/ui/card'
import { Check, Copy, FileCode2, Play, RefreshCw } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const props = defineProps<{
  project: ProjectEntry
  report: RunReport | null
  histories: TestHistory[]
  comparison: RunComparison | null
  loading: boolean
  linked: boolean
}>()
const emit = defineEmits<{
  viewTrace: [traceUrl: string]
  openInEditor: [loc: { file: string, line: number, column: number }]
  rerun: [t: { file: string, line: number, projectName: string, title: string }]
}>()

type Filter = 'failures' | 'regressions' | 'all'
const filter = ref<Filter>('failures')
const copiedKey = ref('')

const RANK: Record<string, number> = { unexpected: 0, flaky: 1, expected: 2, skipped: 3 }

function color(status: NormTest['status']): string {
  return status === 'unexpected'
    ? 'bg-fail'
    : status === 'flaky'
      ? 'bg-flaky'
      : status === 'expected'
        ? 'bg-pass'
        : 'bg-muted-foreground/40'
}
function isFail(t: NormTest): boolean {
  return t.status === 'unexpected' || t.status === 'flaky'
}
function traceUrl(t: NormTest): string | undefined {
  return t.attachments.find(a => a.url && (a.name === 'trace' || a.contentType === 'application/zip'))?.url
}

// One label per test: this run's outcome, qualified by the history trend.
function labelFor(t: NormTest, h: TestHistory | undefined): { text: string, cls: string } {
  if (t.status === 'unexpected')
    return { text: h?.newlyBroken ? 'New break' : 'Failing', cls: 'text-fail' }
  if (t.status === 'flaky')
    return { text: h?.newlyFlaky ? 'Newly flaky' : 'Flaky', cls: 'text-flaky' }
  if (t.status === 'expected')
    return { text: 'Passed', cls: 'text-pass' }
  return { text: 'Skipped', cls: 'text-muted-foreground' }
}
function rateHint(t: NormTest, h: TestHistory | undefined): string {
  if (!h)
    return ''
  if (t.status === 'unexpected' && h.recentFailRate > 0)
    return `${formatPct(h.recentFailRate)} fail`
  if (t.status === 'flaky' && h.recentFlakyRate > 0)
    return `${formatPct(h.recentFlakyRate)} flaky`
  return ''
}
function relTime(iso: string): string {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000)
  if (h < 1)
    return 'just now'
  if (h < 24)
    return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

const historyMap = computed(() => new Map(props.histories.map(h => [h.testKey, h])))
const regressedKeys = computed(() => new Set(
  (props.comparison?.tests ?? [])
    .filter(t => t.change === 'broken' || t.change === 'newly-flaky')
    .map(t => t.testKey),
))
const greenRel = computed(() => (props.comparison ? relTime(props.comparison.base.startedAt) : ''))

const allTests = computed(() => [...(props.report?.tests ?? [])].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9)))
const failed = computed(() => allTests.value.filter(isFail))
const rate = computed(() => (props.report ? passRate(props.report.counts) : 0))

const filterOptions = computed(() => {
  const opts: { key: Filter, label: string }[] = [{ key: 'failures', label: `Failing ${failed.value.length}` }]
  if (regressedKeys.value.size)
    opts.push({ key: 'regressions', label: `Regressed ${regressedKeys.value.size}` })
  opts.push({ key: 'all', label: 'All' })
  return opts
})

const rows = computed(() => {
  const list = filter.value === 'all'
    ? allTests.value
    : filter.value === 'regressions'
      ? failed.value.filter(t => regressedKeys.value.has(t.testKey))
      : failed.value
  return list.map((test) => {
    const h = historyMap.value.get(test.testKey)
    return {
      test,
      fail: isFail(test),
      strip: h ? h.points.slice(-14).map(p => p.status) : [],
      label: labelFor(test, h),
      rate: rateHint(test, h),
      trace: traceUrl(test),
    }
  })
})

async function copyPrompt(test: NormTest): Promise<void> {
  const errors = test.errors.map(e => (e.stack ? `${e.message}\n${e.stack}` : e.message)).join('\n\n')
  const prompt = `This Playwright test is failing. Find the root cause and fix it.

Test: ${test.title}
File: ${test.file}:${test.line}
Project: ${test.projectName}
Status: ${test.status}

Error:
${errors || '(no error captured)'}`
  await navigator.clipboard.writeText(prompt)
  copiedKey.value = test.testKey
  setTimeout(() => {
    if (copiedKey.value === test.testKey)
      copiedKey.value = ''
  }, 1500)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">
          {{ project.name }}
        </h1>
        <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {{ project.id }} · latest run
        </p>
      </div>
      <div v-if="report" class="flex items-center gap-4 font-mono text-xs tabular-nums">
        <span class="text-pass">{{ report.counts.expected }} passed</span>
        <span v-if="report.counts.unexpected" class="text-fail">{{ report.counts.unexpected }} failed</span>
        <span v-if="report.counts.flaky" class="text-flaky">{{ report.counts.flaky }} flaky</span>
        <span class="text-muted-foreground">{{ formatPct(rate) }}</span>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center font-mono text-sm text-muted-foreground">
      Loading latest run…
    </div>
    <div v-else-if="!report" class="py-16 text-center font-mono text-sm text-muted-foreground">
      No runs yet for this project.
    </div>
    <template v-else>
      <div
        v-if="regressedKeys.size"
        class="rounded-md border border-fail/30 bg-fail/5 px-3 py-2 font-mono text-[11px] text-fail"
      >
        {{ regressedKeys.size }} {{ regressedKeys.size === 1 ? 'test' : 'tests' }} broke since the last green run · {{ greenRel }}
      </div>

      <div class="flex items-center gap-1">
        <button
          v-for="opt in filterOptions"
          :key="opt.key"
          type="button"
          class="rounded-md px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase transition-colors"
          :class="filter === opt.key ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="filter = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>

      <div v-if="rows.length === 0" class="flex flex-col items-center gap-1.5 py-14 text-center">
        <template v-if="filter === 'failures'">
          <p class="text-sm font-medium text-pass">
            All green
          </p>
          <p class="text-xs text-muted-foreground">
            No failures in the latest run.
          </p>
        </template>
        <p v-else class="text-sm text-muted-foreground">
          No tests.
        </p>
      </div>
      <Card v-else class="gap-0 divide-y divide-border/60 p-0">
        <div v-for="row in rows" :key="row.test.testKey" class="flex items-start gap-3 px-4 py-3">
          <span class="mt-1.5 size-1.5 shrink-0 rounded-full" :class="color(row.test.status)" />
          <div class="min-w-0 flex-1 space-y-1">
            <p class="truncate text-sm">
              {{ row.test.title }}
            </p>
            <p class="truncate font-mono text-[11px] text-muted-foreground">
              {{ row.test.file }}:{{ row.test.line }} · {{ row.test.projectName }}
            </p>
            <p v-if="row.test.errors[0]" class="line-clamp-2 font-mono text-[11px] text-fail/80">
              {{ row.test.errors[0].message }}
            </p>
            <div v-if="row.strip.length || row.rate" class="flex items-center gap-2 pt-0.5">
              <div v-if="row.strip.length" class="flex items-center gap-[2px]">
                <span v-for="(s, i) in row.strip" :key="i" class="size-1.5 rounded-[1px]" :class="color(s)" />
              </div>
              <span v-if="row.rate" class="font-mono text-[10px] text-muted-foreground">{{ row.rate }}</span>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <span class="font-mono text-[11px] tracking-wider uppercase" :class="row.label.cls">
              {{ row.label.text }}
            </span>
            <div class="flex gap-1.5">
              <Button
                v-if="row.fail"
                variant="outline"
                size="sm"
                class="h-7 gap-1.5 font-mono text-[11px]"
                :title="linked ? 'Re-run this test locally' : 'Link a local repo, then re-run'"
                @click="emit('rerun', { file: row.test.file, line: row.test.line, projectName: row.test.projectName, title: row.test.title })"
              >
                <RefreshCw class="size-3" />
                Re-run
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-7 gap-1.5 font-mono text-[11px]"
                :title="linked ? 'Open in editor' : 'Link a local repo, then open in editor'"
                @click="emit('openInEditor', { file: row.test.file, line: row.test.line, column: row.test.column })"
              >
                <FileCode2 class="size-3" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-7 gap-1.5 font-mono text-[11px]"
                :title="copiedKey === row.test.testKey ? 'Copied' : 'Copy a fix prompt'"
                @click="copyPrompt(row.test)"
              >
                <Check v-if="copiedKey === row.test.testKey" class="size-3" />
                <Copy v-else class="size-3" />
                Prompt
              </Button>
              <Button
                v-if="row.trace"
                variant="outline"
                size="sm"
                class="h-7 gap-1.5 font-mono text-[11px]"
                @click="emit('viewTrace', row.trace)"
              >
                <Play class="size-3" />
                Trace
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>
