<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { HTMLAttributes } from 'vue'
import type { ChartConfig } from '../chart'
import { VisArea, VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { ChartContainer, ChartCrosshair, ChartTooltip, ChartTooltipContent, componentToString } from '../chart'

// Thin kinora wrapper over the shadcn-vue chart primitives (Unovis) for single-series time bands.
const props = defineProps<{
  data: T[]
  x: (d: T, i: number) => number
  y: (d: T) => number
  config: ChartConfig
  // Config key that carries the series color/label; also the datum field the tooltip reads.
  seriesKey: string
  xTickFormat?: (i: number) => string
  class?: HTMLAttributes['class']
}>()

// Built once in setup (componentToString calls useId internally). The crosshair label is the
// x value (our datum index), so format it through xTickFormat to show the bucket date, not the index.
const tooltip = componentToString(props.config, ChartTooltipContent, {
  labelFormatter: props.xTickFormat ? (d: number | Date) => props.xTickFormat!(Number(d)) : undefined,
})
</script>

<template>
  <ChartContainer :config="config" :class="props.class" cursor>
    <VisXYContainer :data="data">
      <VisArea :x="x" :y="y" :color="`var(--color-${seriesKey})`" :opacity="0.15" />
      <VisLine :x="x" :y="y" :color="`var(--color-${seriesKey})`" />
      <VisAxis
        v-if="xTickFormat"
        type="x"
        :x="x"
        :tick-format="xTickFormat"
        :grid-line="false"
        :domain-line="false"
        :tick-line="false"
      />
      <ChartTooltip />
      <ChartCrosshair :template="tooltip" :color="`var(--color-${seriesKey})`" />
    </VisXYContainer>
  </ChartContainer>
</template>
