<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next'
import { computed } from 'vue'
import { useTraceStore } from '../store'

const store = useTraceStore()

const errors = computed(() => {
  const m = store.model.value
  if (!m)
    return []
  return m.errorDescriptors.map(e => ({
    message: e.message,
    where: e.action ? `${e.action.class}.${e.action.method}` : undefined,
  }))
})
</script>

<template>
  <div class="h-full overflow-y-auto p-3">
    <div v-if="!errors.length" class="flex h-full items-center justify-center text-sm text-muted-foreground">
      No errors in this trace
    </div>
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(err, i) in errors"
        :key="i"
        class="overflow-hidden rounded-md border border-fail/30 bg-fail/5"
      >
        <div class="flex items-center gap-2 border-b border-fail/20 bg-fail/10 px-3 py-1.5">
          <CircleAlert class="size-3.5 text-fail" />
          <span v-if="err.where" class="font-mono text-xs text-fail">{{ err.where }}</span>
        </div>
        <pre class="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">{{ err.message }}</pre>
      </div>
    </div>
  </div>
</template>
