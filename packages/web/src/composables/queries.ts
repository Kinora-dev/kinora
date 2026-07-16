import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'

// App-level server capabilities (SMTP, Slack OAuth, demo). Static per deployment, so fetch once + share.
let serverConfig: ReturnType<typeof loadServerConfig> | undefined
function loadServerConfig() {
  return useAsyncState(() => trpc.config.get.query(), null, { immediate: true })
}
export function useServerConfig() {
  serverConfig ??= loadServerConfig()
  return serverConfig
}

// Read-only public demo: drives the banner + disables mutation controls.
export function useDemo() {
  const { state } = useServerConfig()
  return computed(() => state.value?.demo ?? false)
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
    { project: null, histories: [], clusters: [] },
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

export function useAdminOverview() {
  return useAsyncState(() => trpc.admin.overview.query(), null, { immediate: true })
}

export function useAdminTimeseries() {
  return useAsyncState(() => trpc.admin.timeseries.query(), { signups: [], runs: [] }, { immediate: true })
}

export function useAdminAccounts() {
  return useAsyncState(() => trpc.admin.accounts.query(), [], { immediate: true })
}
