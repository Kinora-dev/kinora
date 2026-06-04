<script setup lang="ts">
import { computed } from 'vue'
import type { PwTestStatus } from '@/contracts/playwright'

const props = defineProps<{ status: PwTestStatus }>()

const map: Record<PwTestStatus, { label: string; dot: string; text: string }> = {
  expected: { label: 'Pass', dot: 'bg-pass', text: 'text-pass' },
  unexpected: { label: 'Fail', dot: 'bg-fail', text: 'text-fail' },
  flaky: { label: 'Flaky', dot: 'bg-flaky', text: 'text-flaky' },
  skipped: { label: 'Skip', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}
const s = computed(() => map[props.status])
</script>

<template>
  <span class="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium" :class="s.text">
    <span class="size-1.5 rounded-full" :class="s.dot" />
    {{ s.label }}
  </span>
</template>
