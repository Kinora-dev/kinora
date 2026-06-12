<script setup lang="ts">
import { computed } from 'vue'
import { useTraceStore } from '../store'

const store = useTraceStore()

const lines = computed(() => store.selectedAction.value?.log ?? [])
</script>

<template>
  <div class="h-full overflow-auto py-1">
    <div v-if="!lines.length" class="flex h-full items-center justify-center text-sm text-muted-foreground">
      No log for this action
    </div>
    <div
      v-for="(line, i) in lines"
      :key="i"
      class="border-l-2 border-l-transparent px-3 py-0.5 font-mono text-xs text-foreground/80"
    >
      {{ line.message }}
    </div>
  </div>
</template>
