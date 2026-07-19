<script setup lang="ts">
import type { FailureCluster, TestHistory } from '@kinora/core'
import { Badge } from '@kinora/ui/badge'
import { Button } from '@kinora/ui/button'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import CopyButton from '@/components/app/CopyButton.vue'
import { testLabel } from '@/lib/test-display'

const props = defineProps<{ clusters: FailureCluster[], histories: TestHistory[], projectId: string }>()

const TOP = 5

const showAll = ref(false)
const visible = computed(() => (showAll.value ? props.clusters : props.clusters.slice(0, TOP)))

const labels = computed(() => new Map(props.histories.map(h => [h.testKey, testLabel(h)])))
function label(testKey: string): string {
  return labels.value.get(testKey) ?? testKey
}

const expanded = ref(new Set<string>())
function toggle(fp: string): void {
  const next = new Set(expanded.value)
  next.has(fp) ? next.delete(fp) : next.add(fp)
  expanded.value = next
}
</script>

<template>
  <div v-if="clusters.length" class="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 px-6 py-5">
    <div class="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <span>Top failure causes</span>
      <span>{{ clusters.length }} distinct {{ clusters.length === 1 ? 'error' : 'errors' }}</span>
    </div>

    <div class="flex flex-col gap-2">
      <div
        v-for="c in visible"
        :key="c.fingerprint"
        class="rounded-lg border border-border/60 bg-background/40"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 px-3 py-2.5 text-left"
          @click="toggle(c.fingerprint)"
        >
          <component :is="expanded.has(c.fingerprint) ? ChevronDown : ChevronRight" class="size-3.5 shrink-0 text-muted-foreground/60" />
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-fail">{{ c.title }}</span>
          <Badge class="shrink-0 border-fail/30 bg-fail/15 text-[10px] text-fail">
            {{ c.tests }} {{ c.tests === 1 ? 'test' : 'tests' }}
          </Badge>
          <span class="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{{ c.count }}×</span>
        </button>

        <div v-if="expanded.has(c.fingerprint)" class="flex flex-col gap-3 border-t border-border/60 px-3 py-3">
          <div class="relative">
            <pre class="max-h-56 overflow-auto rounded-md bg-fail/5 p-3 pr-10 font-mono text-[11px] leading-relaxed text-fail">{{ c.sample }}</pre>
            <CopyButton :text="c.sample" class="absolute right-1 top-1" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Affected {{ c.tests === 1 ? 'test' : 'tests' }}
            </span>
            <RouterLink
              v-for="key in c.testKeys"
              :key="key"
              :to="{ name: 'test', params: { projectId }, query: { key } }"
              class="truncate font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              {{ label(key) }}
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <Button
      v-if="clusters.length > TOP"
      variant="outline"
      size="sm"
      class="mt-1 self-center font-mono text-xs text-muted-foreground"
      @click="showAll = !showAll"
    >
      {{ showAll ? 'Show less' : `Show all ${clusters.length}` }}
    </Button>
  </div>
</template>
