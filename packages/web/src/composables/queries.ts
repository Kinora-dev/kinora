import { useAsyncState } from '@vueuse/core'
import { trpc } from '@/lib/trpc'

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
