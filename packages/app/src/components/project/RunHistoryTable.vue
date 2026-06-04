<script setup lang="ts">
import type { RunHealth, RunSummary } from '@playback/core'
import type { ColumnDef, SortingState } from '@tanstack/vue-table'
import { formatDuration, formatPct, passRate, runHealth } from '@playback/core'
import { getCoreRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-vue-next'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { valueUpdater } from '@/components/ui/table/utils'
import HealthBadge from '@/components/viz/HealthBadge.vue'

const props = defineProps<{ runs: RunSummary[], projectId: string }>()

const router = useRouter()

// Worst-first ordering when sorting health descending.
const HEALTH_RANK: Record<RunHealth, number> = { failing: 3, flaky: 2, passing: 1, empty: 0 }

const columns: ColumnDef<RunSummary>[] = [
  { id: 'run', accessorFn: r => r.startedAt }, // ISO string sorts chronologically
  { id: 'health', accessorFn: r => HEALTH_RANK[runHealth(r.counts)] },
  { id: 'pass', accessorFn: r => passRate(r.counts) },
  { id: 'fail', accessorFn: r => r.counts.unexpected },
  { id: 'flaky', accessorFn: r => r.counts.flaky },
  { id: 'duration', accessorFn: r => r.duration },
  { id: 'sha', accessorFn: r => r.git?.sha ?? '', enableSorting: false },
]

const headerCols = [
  { id: 'run', label: 'Run', right: false },
  { id: 'health', label: 'Health', right: false },
  { id: 'pass', label: 'Pass', right: true },
  { id: 'fail', label: 'Fail', right: true },
  { id: 'flaky', label: 'Flaky', right: true },
  { id: 'duration', label: 'Duration', right: true },
  { id: 'sha', label: 'SHA', right: true },
] as const

const sorting = ref<SortingState>([{ id: 'run', desc: true }])

const table = useVueTable({
  get data() { return props.runs },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  onSortingChange: updaterOrValue => valueUpdater(updaterOrValue, sorting),
  state: {
    get sorting() { return sorting.value },
  },
})

function sortDir(id: string) {
  return table.getColumn(id)?.getIsSorted()
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
</script>

<template>
  <div class="rounded-xl border border-border/70 bg-card/80 overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead
            v-for="col in headerCols"
            :key="col.id"
            class="font-mono text-[10px] uppercase tracking-wider"
            :class="col.right ? 'text-right' : ''"
          >
            <button
              v-if="table.getColumn(col.id)?.getCanSort()"
              type="button"
              class="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
              @click="table.getColumn(col.id)?.toggleSorting()"
            >
              {{ col.label }}
              <ArrowUp v-if="sortDir(col.id) === 'asc'" class="size-3" />
              <ArrowDown v-else-if="sortDir(col.id) === 'desc'" class="size-3" />
              <ChevronsUpDown v-else class="size-3 opacity-40" />
            </button>
            <span v-else>{{ col.label }}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="row in table.getRowModel().rows"
          :key="row.original.runId"
          class="cursor-pointer"
          @click="router.push({ name: 'run', params: { projectId, runId: row.original.runId } })"
        >
          <TableCell class="font-mono text-xs">
            {{ dateFmt.format(new Date(row.original.startedAt)) }}
          </TableCell>
          <TableCell><HealthBadge :health="runHealth(row.original.counts)" /></TableCell>
          <TableCell class="text-right font-mono text-xs tabular-nums">
            {{ formatPct(passRate(row.original.counts)) }}
          </TableCell>
          <TableCell class="text-right font-mono text-xs tabular-nums" :class="row.original.counts.unexpected ? 'text-fail' : 'text-muted-foreground'">
            {{ row.original.counts.unexpected }}
          </TableCell>
          <TableCell class="text-right font-mono text-xs tabular-nums" :class="row.original.counts.flaky ? 'text-flaky' : 'text-muted-foreground'">
            {{ row.original.counts.flaky }}
          </TableCell>
          <TableCell class="text-right font-mono text-xs tabular-nums text-muted-foreground">
            {{ formatDuration(row.original.duration) }}
          </TableCell>
          <TableCell class="text-right font-mono text-xs text-muted-foreground">
            {{ row.original.git?.sha ?? '-' }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
