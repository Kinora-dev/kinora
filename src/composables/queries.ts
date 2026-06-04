import { useAsyncState } from '@vueuse/core'
import { getManifest, getProjectHistory, getRun } from '@/data/source'

export function useManifest() {
  return useAsyncState(() => getManifest(), null, { immediate: true })
}

export function useRun(projectId: string, runId: string) {
  return useAsyncState(() => getRun(projectId, runId), null, { immediate: true })
}

export function useProjectHistory(projectId: string) {
  return useAsyncState(
    () => getProjectHistory(projectId),
    { project: null, histories: [] },
    { immediate: true },
  )
}
