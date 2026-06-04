import type { Counts, ProjectEntry, RunSummary } from '@/contracts/playback'

export type RunHealth = 'passing' | 'flaky' | 'failing' | 'empty'

// Skipped tests don't count against the denominator.
export function denom(c: Counts): number {
  return Math.max(0, c.total - c.skipped)
}

// Flaky tests passed eventually, so they count as passing.
export function passRate(c: Counts): number {
  const d = denom(c)
  return d === 0 ? 1 : (c.expected + c.flaky) / d
}

export function runHealth(c: Counts): RunHealth {
  if (c.total === 0) return 'empty'
  if (c.unexpected > 0) return 'failing'
  if (c.flaky > 0) return 'flaky'
  return 'passing'
}

export function sortedRuns(p: ProjectEntry): RunSummary[] {
  return [...p.runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
}

export function latestRun(p: ProjectEntry): RunSummary | undefined {
  return sortedRuns(p)[0]
}

export interface TrendPoint {
  runId: string
  startedAt: string
  passRate: number
  unexpected: number
  flaky: number
  total: number
  duration: number
}

export function trend(p: ProjectEntry): TrendPoint[] {
  return [...p.runs]
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .map((r) => ({
      runId: r.runId,
      startedAt: r.startedAt,
      passRate: passRate(r.counts),
      unexpected: r.counts.unexpected,
      flaky: r.counts.flaky,
      total: r.counts.total,
      duration: r.duration,
    }))
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s % 60)}s`
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}
