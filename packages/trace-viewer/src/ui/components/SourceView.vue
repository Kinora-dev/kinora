<script setup lang="ts">
import type { StackFrame } from '@protocol/channels'
import { computed, ref, watch } from 'vue'
import { cn } from '../lib/cn'
import { calculateSha1 } from '../lib/sha1'
import { useTraceStore } from '../store'

const store = useTraceStore()

const frames = computed<StackFrame[]>(() => ((store.selectedAction.value as any)?.stack ?? []) as StackFrame[])
const selectedFrame = ref(0)
const content = ref('')
const loading = ref(false)

const targetLine = computed(() => frames.value[selectedFrame.value]?.line ?? 0)
const lines = computed(() => content.value.split('\n'))

function fileName(file: string): string {
  return file.split(/[/\\]/).pop() ?? file
}

watch([frames, selectedFrame], async () => {
  selectedFrame.value = Math.min(selectedFrame.value, Math.max(0, frames.value.length - 1))
  const frame = frames.value[selectedFrame.value]
  const model = store.model.value
  if (!frame?.file || !model) {
    content.value = ''
    return
  }
  loading.value = true
  try {
    const sha1 = await calculateSha1(frame.file)
    const res = await fetch(model.createRelativeUrl(`sha1/src@${sha1}.txt`))
    content.value = res.ok ? await res.text() : `Source unavailable for ${frame.file}`
  }
  catch {
    content.value = `Unable to read ${frame.file}`
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

watch(() => store.selectedId.value, () => {
  selectedFrame.value = 0
})
</script>

<template>
  <div class="flex h-full">
    <!-- stack frames -->
    <div v-if="frames.length" class="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border">
      <button
        v-for="(frame, i) in frames"
        :key="i"
        type="button"
        :class="cn(
          'flex flex-col gap-0.5 border-b border-border/50 px-3 py-1.5 text-left transition-colors',
          selectedFrame === i ? 'bg-signal/10' : 'hover:bg-muted/50',
        )"
        @click="selectedFrame = i"
      >
        <span class="truncate text-xs text-foreground/90">{{ frame.function || '(anonymous)' }}</span>
        <span class="truncate font-mono text-[10px] text-muted-foreground">{{ fileName(frame.file) }}:{{ frame.line }}</span>
      </button>
    </div>

    <!-- code -->
    <div class="min-w-0 flex-1 overflow-auto">
      <div v-if="loading" class="p-3 text-sm text-muted-foreground">
        Loading source…
      </div>
      <div v-else-if="!frames.length" class="flex h-full items-center justify-center text-sm text-muted-foreground">
        No source for this action
      </div>
      <table v-else class="w-full border-collapse font-mono text-xs leading-[1.6]">
        <tbody>
          <tr
            v-for="(line, i) in lines"
            :key="i"
            :class="cn(i + 1 === targetLine && 'bg-signal/15')"
          >
            <td class="w-12 shrink-0 select-none border-r border-border/50 px-2 text-right align-top text-muted-foreground/50 tabular-nums">
              {{ i + 1 }}
            </td>
            <td
              :class="cn(
                'whitespace-pre px-3 align-top',
                i + 1 === targetLine ? 'text-foreground' : 'text-foreground/80',
              )"
            >
              {{ line || ' ' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
