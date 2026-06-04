<script setup lang="ts">
import type { PwTestStatus } from '@playback/core'
import { pwStatusMeta } from '@playback/core'
import { computed } from 'vue'

const props = defineProps<{ status: PwTestStatus }>()
const s = computed(() => pwStatusMeta[props.status])
</script>

<template>
  <span class="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium" :class="s.text">
    <span class="size-1.5 rounded-full" :class="s.dot" />
    {{ s.label }}
  </span>
</template>
