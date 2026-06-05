<script setup lang="ts">
import { computed } from 'vue'
import { actionDuration } from '../lib/action'
import { formatMs } from '../lib/format'
import { useTraceStore } from '../store'

const store = useTraceStore()

function stringify(value: unknown): string {
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

const rows = computed(() => {
  const action = store.selectedAction.value
  if (!action)
    return []
  const out: { key: string, value: string }[] = [
    { key: 'method', value: `${action.class}.${action.method}` },
    { key: 'duration', value: formatMs(actionDuration(action)) },
  ]
  for (const [key, value] of Object.entries(action.params ?? {}))
    out.push({ key, value: stringify(value) })
  return out
})
</script>

<template>
  <div class="h-full overflow-auto p-3">
    <div v-if="!rows.length" class="flex h-full items-center justify-center text-sm text-muted-foreground">
      No call selected
    </div>
    <table v-else class="w-full text-xs">
      <tbody>
        <tr v-for="row in rows" :key="row.key" class="border-b border-border/40 last:border-0">
          <td class="w-40 py-1.5 pr-4 align-top font-mono text-muted-foreground">
            {{ row.key }}
          </td>
          <td class="py-1.5 align-top font-mono break-all text-foreground/90">
            {{ row.value }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
