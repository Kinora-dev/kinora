import { config, useMock } from '@/config'
import { manifestSchema, runReportSchema } from '@/contracts/playback'
import type { Manifest, RunReport } from '@/contracts/playback'
import { mockManifest, mockRunReport } from './mock'

async function fetchJson(path: string): Promise<unknown> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/${path}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

export async function getManifest(): Promise<Manifest> {
  if (useMock) return mockManifest()
  return manifestSchema.parse(await fetchJson('manifest.json'))
}

export async function getRunReport(reportPath: string): Promise<RunReport> {
  if (useMock) return mockRunReport(reportPath)
  return runReportSchema.parse(await fetchJson(reportPath))
}
