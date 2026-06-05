<script setup lang="ts">
import type { RunSummary } from '@playbackhq/core'
import { formatPct, passRate, runHealth } from '@playbackhq/core'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@playbackhq/ui/tooltip'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = withDefaults(
  defineProps<{ runs: RunSummary[], limit?: number, height?: number }>(),
  { limit: 30, height: 38 },
)

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

// Chronological, oldest first, capped to the most recent `limit`.
const bars = computed(() =>
  [...props.runs]
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .slice(-props.limit)
    .map((r) => {
      const health = runHealth(r.counts)
      return {
        run: r,
        health,
        pct: passRate(r.counts),
        color:
          health === 'passing'
            ? 'bg-pass'
            : health === 'flaky'
              ? 'bg-flaky'
              : health === 'failing'
                ? 'bg-fail'
                : 'bg-muted-foreground/40',
        date: dateFmt.format(new Date(r.startedAt)),
      }
    }),
)
</script>

<template>
  <TooltipProvider :delay-duration="80">
    <div class="flex items-end gap-[3px]" :style="{ height: `${height}px` }">
      <Tooltip v-for="b in bars" :key="b.run.runId">
        <TooltipTrigger as-child>
          <RouterLink
            :to="{ name: 'run', params: { projectId: b.run.projectId, runId: b.run.runId } }"
            class="group relative flex h-full flex-1 items-end"
          >
            <span
              class="w-full rounded-[2px] opacity-80 transition-all duration-150 group-hover:opacity-100 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-offset-background"
              :class="[b.color, b.health === 'passing' ? 'group-hover:ring-pass/40' : b.health === 'flaky' ? 'group-hover:ring-flaky/40' : 'group-hover:ring-fail/40']"
              :style="{ height: `${Math.max(12, b.pct * 100)}%` }"
            />
          </RouterLink>
        </TooltipTrigger>
        <TooltipContent class="font-mono text-xs">
          <div class="font-semibold">
            {{ b.date }}
          </div>
          <div class="mt-0.5 tabular-nums text-muted-foreground">
            {{ formatPct(b.pct) }} pass
          </div>
          <div class="tabular-nums text-muted-foreground">
            {{ b.run.counts.unexpected }} fail / {{ b.run.counts.flaky }} flaky
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
