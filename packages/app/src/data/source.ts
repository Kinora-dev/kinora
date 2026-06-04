import type { Manifest, ProjectHistory, RunReport } from '@playbackhq/core'
import {

  buildTestHistories,

  manifestSchema,

  projectHistorySchema,
  runReportSchema,
} from '@playbackhq/core'
import { config, useMock } from '@/config'
import { mockManifest, mockRun } from './mock'

// One contract, swappable transport. The UI only ever calls these three.
interface DataSource {
  getManifest: () => Promise<Manifest>
  getRun: (projectId: string, runId: string) => Promise<RunReport>
  getProjectHistory: (projectId: string) => Promise<ProjectHistory>
}

function base(): string {
  return config.baseUrl.replace(/\/$/, '')
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

// Client-side fold: fetch every run report and build per-test timelines.
// Used when the transport has no dedicated history endpoint (static, mock).
async function foldHistory(src: DataSource, projectId: string): Promise<ProjectHistory> {
  const manifest = await src.getManifest()
  const project = manifest.projects.find(p => p.id === projectId) ?? null
  if (!project)
    return { project: null, histories: [] }
  const reports = await Promise.all(project.runs.map(r => src.getRun(projectId, r.runId)))
  return { project, histories: buildTestHistories(reports) }
}

const staticSource: DataSource = {
  getManifest: async () => manifestSchema.parse(await fetchJson(`${base()}/manifest.json`)),
  getRun: async (p, r) =>
    runReportSchema.parse(await fetchJson(`${base()}/reports/${p}/${r}.json`)),
  getProjectHistory: p => foldHistory(staticSource, p),
}

const restSource: DataSource = {
  getManifest: async () => manifestSchema.parse(await fetchJson(`${base()}/api/manifest`)),
  getRun: async (p, r) =>
    runReportSchema.parse(
      await fetchJson(`${base()}/api/projects/${encodeURIComponent(p)}/runs/${encodeURIComponent(r)}`),
    ),
  // Server-side aggregation: one request, no downloading every report.
  getProjectHistory: async p =>
    projectHistorySchema.parse(
      await fetchJson(`${base()}/api/projects/${encodeURIComponent(p)}/tests`),
    ),
}

const mockSource: DataSource = {
  getManifest: async () => mockManifest(),
  getRun: async (p, r) => mockRun(p, r),
  getProjectHistory: p => foldHistory(mockSource, p),
}

const source: DataSource = useMock
  ? mockSource
  : config.mode === 'rest'
    ? restSource
    : staticSource

export const getManifest = () => source.getManifest()
export const getRun = (projectId: string, runId: string) => source.getRun(projectId, runId)
export const getProjectHistory = (projectId: string) => source.getProjectHistory(projectId)
