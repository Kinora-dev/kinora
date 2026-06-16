<script setup lang="ts">
import type { ProjectEntry } from '@kinora/core'
import { formatDuration, formatPct, latestRun, passRate, runHealth, sortedRuns, trend } from '@kinora/core'
import { Card } from '@kinora/ui/card'
import { ArrowDownRight, ArrowUpRight } from 'lucide-vue-next'
import { computed } from 'vue'
import HealthBadge from './HealthBadge.vue'
import RunStrip from './RunStrip.vue'
import Sparkline from './Sparkline.vue'

const props = defineProps<{ project: ProjectEntry }>()
defineEmits<{ open: [] }>()

const runs = computed(() => sortedRuns(props.project))
const latest = computed(() => latestRun(props.project))
const health = computed(() => (latest.value ? runHealth(latest.value.counts) : 'empty'))
const rate = computed(() => (latest.value ? passRate(latest.value.counts) : 0))
const prevRate = computed(() => {
  const r = runs.value[1]
  return r ? passRate(r.counts) : null
})
const delta = computed(() => (prevRate.value == null ? null : rate.value - prevRate.value))
const series = computed(() => trend(props.project).map(t => t.passRate))

const toneText = computed(() =>
  health.value === 'passing'
    ? 'text-pass'
    : health.value === 'flaky'
      ? 'text-flaky'
      : health.value === 'failing'
        ? 'text-fail'
        : 'text-muted-foreground',
)

const rel = computed(() => {
  if (!latest.value)
    return ''
  const diff = Date.now() - Date.parse(latest.value.startedAt)
  const h = Math.round(diff / 3_600_000)
  if (h < 1)
    return 'just now'
  if (h < 24)
    return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
})
</script>

<template>
  <Card data-project class="group flex cursor-pointer flex-col gap-0 overflow-hidden p-0 transition-colors hover:border-border" @click="$emit('open')">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 p-5 pb-4">
      <div class="min-w-0">
        <span class="block truncate text-[15px] font-semibold tracking-tight">
          {{ project.name }}
        </span>
        <p v-if="project.description" class="mt-0.5 truncate text-xs text-muted-foreground">
          {{ project.description }}
        </p>
        <p v-else class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {{ project.id }}
        </p>
      </div>
      <HealthBadge :health="health" />
    </div>

    <!-- Pass rate + sparkline -->
    <div class="flex items-end justify-between gap-4 px-5">
      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Pass rate
        </span>
        <div class="flex items-baseline gap-2">
          <span class="font-mono text-3xl font-semibold tabular-nums leading-none" :class="toneText">
            {{ formatPct(rate) }}
          </span>
          <span
            v-if="delta != null && Math.abs(delta) >= 0.001"
            class="flex items-center font-mono text-xs tabular-nums"
            :class="delta >= 0 ? 'text-pass' : 'text-fail'"
          >
            <component :is="delta >= 0 ? ArrowUpRight : ArrowDownRight" class="size-3" />
            {{ formatPct(Math.abs(delta)) }}
          </span>
        </div>
      </div>
      <div class="w-1/2 max-w-[220px]" :class="toneText">
        <Sparkline :values="series" :height="40" />
      </div>
    </div>

    <!-- Run strip -->
    <div class="px-5 pt-4">
      <RunStrip :runs="project.runs" :limit="30" />
    </div>

    <!-- Footer -->
    <div
      class="mt-4 flex items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-5 py-2.5 font-mono text-[11px] text-muted-foreground"
    >
      <span class="tabular-nums">{{ project.runs.length }} runs</span>
      <span v-if="latest" class="tabular-nums">
        {{ latest.counts.total }} tests &middot; {{ formatDuration(latest.duration) }}
      </span>
      <span class="tabular-nums">{{ rel }}</span>
    </div>
  </Card>
</template>
