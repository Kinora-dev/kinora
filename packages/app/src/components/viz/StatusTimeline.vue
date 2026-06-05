<script setup lang="ts">
import type { TestPoint } from '@playbackhq/core'
import { pwStatusMeta } from '@playbackhq/core'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@playbackhq/ui/tooltip'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = withDefaults(
  defineProps<{ points: TestPoint[], projectId: string, height?: number, link?: boolean, q?: string }>(),
  { height: 20, link: true },
)

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const cells = computed(() =>
  props.points.map(p => ({
    point: p,
    meta: pwStatusMeta[p.status],
    date: dateFmt.format(new Date(p.startedAt)),
  })),
)
</script>

<template>
  <TooltipProvider :delay-duration="80">
    <div class="flex items-stretch gap-[3px]" :style="{ height: `${height}px` }">
      <Tooltip v-for="c in cells" :key="c.point.runId">
        <TooltipTrigger as-child>
          <component
            :is="link ? RouterLink : 'div'"
            :to="link ? { name: 'run', params: { projectId, runId: c.point.runId }, query: q ? { q } : undefined } : undefined"
            class="group flex flex-1 items-stretch"
          >
            <span
              class="w-full min-w-[3px] rounded-[2px] opacity-85 transition-all duration-150 group-hover:opacity-100"
              :class="c.meta.cell"
            />
          </component>
        </TooltipTrigger>
        <TooltipContent class="font-mono text-xs">
          <div class="font-semibold">
            {{ c.date }}
          </div>
          <div class="mt-0.5" :class="c.meta.text">
            {{ c.meta.label }}
          </div>
          <div v-if="c.point.retries" class="text-muted-foreground">
            {{ c.point.retries }} retry
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
