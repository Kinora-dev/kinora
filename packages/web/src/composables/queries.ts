import { useAsyncState } from '@vueuse/core'
import { trpc } from '@/lib/trpc'

export function useServerConfig() {
  return useAsyncState(() => trpc.config.get.query(), null, { immediate: true })
}

export function useManifest() {
  return useAsyncState(() => trpc.dashboard.manifest.query(), null, { immediate: true })
}

export function useRun(projectId: string, runId: string) {
  return useAsyncState(() => trpc.dashboard.run.query({ projectId, runId }), null, { immediate: true })
}

export function useProjectHistory(projectId: string) {
  return useAsyncState(
    () => trpc.dashboard.projectHistory.query({ projectId }),
    { project: null, histories: [] },
    { immediate: true },
  )
}

export function useCompareRuns(projectId: string, baseRunId: string, headRunId: string) {
  return useAsyncState(
    () => trpc.dashboard.compareRuns.query({ projectId, baseRunId, headRunId }),
    null,
    { immediate: true },
  )
}
