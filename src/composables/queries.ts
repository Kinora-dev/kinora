import { useAsyncState } from '@vueuse/core'
import { getManifest, getRunReport } from '@/data/source'
import { buildTestHistories, type TestHistory } from '@/lib/history'
import type { ProjectEntry } from '@/contracts/playback'

export function useManifest() {
  return useAsyncState(() => getManifest(), null, { immediate: true })
}

export function useRunReport(reportPath: string) {
  return useAsyncState(() => getRunReport(reportPath), null, { immediate: true })
}

interface ProjectHistory {
  project: ProjectEntry | null
  histories: TestHistory[]
}

// Fetches every run report for a project, then folds them into per-test
// timelines. One report fetch per run (parallel).
export function useProjectHistory(projectId: string) {
  return useAsyncState<ProjectHistory>(
    async () => {
      const manifest = await getManifest()
      const project = manifest.projects.find((p) => p.id === projectId) ?? null
      if (!project) return { project: null, histories: [] }
      const reports = await Promise.all(project.runs.map((r) => getRunReport(r.reportPath)))
      return { project, histories: buildTestHistories(reports) }
    },
    { project: null, histories: [] },
    { immediate: true },
  )
}
