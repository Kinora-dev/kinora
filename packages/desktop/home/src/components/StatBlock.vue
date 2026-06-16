<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'pass' | 'flaky' | 'fail'
}>()

const toneClass: Record<string, string> = {
  default: 'text-foreground',
  pass: 'text-pass',
  flaky: 'text-flaky',
  fail: 'text-fail',
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
      {{ label }}
    </span>
    <span
      class="font-mono text-2xl font-semibold tabular-nums leading-none"
      :class="toneClass[tone ?? 'default']"
    >
      {{ value }}
    </span>
    <span v-if="sub" class="text-xs text-muted-foreground">{{ sub }}</span>
  </div>
</template>
