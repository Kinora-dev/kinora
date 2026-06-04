<script setup lang="ts">
import type { RunHealth } from '@playback/core'
import { computed } from 'vue'

const props = defineProps<{ health: RunHealth, size?: 'sm' | 'md' }>()

const map: Record<RunHealth, { label: string, dot: string, text: string, ring: string }> = {
  passing: { label: 'Passing', dot: 'bg-pass', text: 'text-pass', ring: 'ring-pass/25' },
  flaky: { label: 'Flaky', dot: 'bg-flaky', text: 'text-flaky', ring: 'ring-flaky/25' },
  failing: { label: 'Failing', dot: 'bg-fail', text: 'text-fail', ring: 'ring-fail/25' },
  empty: { label: 'No tests', dot: 'bg-muted-foreground', text: 'text-muted-foreground', ring: 'ring-border' },
}
const s = computed(() => map[props.health])
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ring-1"
    :class="[s.text, s.ring]"
  >
    <span class="size-1.5 rounded-full" :class="s.dot" />
    {{ s.label }}
  </span>
</template>
