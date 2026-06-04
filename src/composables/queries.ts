import { useAsyncState } from '@vueuse/core'
import { getManifest, getRunReport } from '@/data/source'

export function useManifest() {
  return useAsyncState(() => getManifest(), null, { immediate: true })
}

export function useRunReport(reportPath: string) {
  return useAsyncState(() => getRunReport(reportPath), null, { immediate: true })
}
