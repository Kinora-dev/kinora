<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    values: number[]
    width?: number
    height?: number
    min?: number
    max?: number
  }>(),
  { width: 220, height: 44, min: 0, max: 1 },
)

const uid = useId()
const pad = 3

const points = computed(() => {
  const vs = props.values
  if (vs.length === 0)
    return []
  const span = Math.max(1e-6, props.max - props.min)
  const stepX = vs.length === 1 ? 0 : (props.width - pad * 2) / (vs.length - 1)
  return vs.map((v, i) => {
    const norm = (v - props.min) / span
    const x = pad + i * stepX
    const y = props.height - pad - norm * (props.height - pad * 2)
    return [x, y] as const
  })
})

const line = computed(() => points.value.map(([x, y]) => `${x},${y}`).join(' '))
const area = computed(() => {
  const p = points.value
  if (p.length === 0)
    return ''
  const top = p.map(([x, y]) => `${x},${y}`).join(' ')
  return `${pad},${props.height - pad} ${top} ${props.width - pad},${props.height - pad}`
})
const last = computed(() => points.value.at(-1))
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    preserveAspectRatio="none"
    class="overflow-visible text-current"
  >
    <defs>
      <linearGradient :id="`spark-${uid}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.18" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon v-if="area" :points="area" :fill="`url(#spark-${uid})`" />
    <polyline
      v-if="line"
      :points="line"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
    <circle
      v-if="last"
      :cx="last[0]"
      :cy="last[1]"
      r="2.4"
      fill="currentColor"
    />
  </svg>
</template>
