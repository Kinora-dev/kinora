import type { Manifest, NormTest, ProjectEntry, RunReport, RunSummary } from '@kinora/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function makeRunSummary(runId: string): RunSummary {
  return {
    runId,
    projectId: 'web-app',
    startedAt: '2026-01-01T00:00:00Z',
    duration: 0,
    counts: { total: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    reportPath: `reports/web-app/${runId}.json`,
    countsByTag: {},
  }
}

function makeProject(id: string, runs: RunSummary[]): ProjectEntry {
  return { id, name: id, runs }
}

function makeManifest(projects: ProjectEntry[]): Manifest {
  return { schemaVersion: 1, generatedAt: '2026-01-01T00:00:00Z', projects }
}

function makeTest(testKey: string): NormTest {
  return {
    testKey,
    title: 't',
    titlePath: ['t'],
    file: 'f.ts',
    line: 1,
    column: 1,
    projectName: 'chromium',
    status: 'expected',
    ok: true,
    duration: 100,
    retries: 0,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
  }
}

function makeReport(runId: string, tests: NormTest[]): RunReport {
  return {
    schemaVersion: 1,
    runId,
    projectId: 'web-app',
    startedAt: '2026-01-01T00:00:00Z',
    duration: 0,
    counts: { total: tests.length, expected: tests.length, unexpected: 0, flaky: 0, skipped: 0 },
    meta: {},
    tests,
  }
}

function jsonResponse(body: unknown, init?: { ok?: boolean, status?: number, statusText?: string }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as unknown as Response
}

// Routes fetch by exact URL; unknown URL -> 404. Returns the spy for assertions.
function stubFetch(routes: Record<string, unknown>, init?: { ok?: boolean, status?: number, statusText?: string }) {
  const spy = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (!(url in routes) && !init)
      return jsonResponse(null, { ok: false, status: 404, statusText: 'Not Found' })
    return jsonResponse(routes[url] ?? null, init)
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

async function loadSource(cfg: { baseUrl: string, mode?: 'static' | 'rest' }, useMock = false) {
  vi.resetModules()
  vi.doMock('@/config', () => ({
    config: { baseUrl: cfg.baseUrl, mode: cfg.mode ?? 'static', title: 'x' },
    useMock,
  }))
  return import('./source')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('@/config')
})

describe('staticSource', () => {
  it('fetches manifest.json and strips a trailing slash from baseUrl', async () => {
    const manifest = makeManifest([makeProject('web-app', [])])
    const fetchSpy = stubFetch({ 'https://x.test/manifest.json': manifest })
    const { getManifest } = await loadSource({ baseUrl: 'https://x.test/' })

    const result = await getManifest()

    expect(fetchSpy).toHaveBeenCalledWith('https://x.test/manifest.json', expect.anything())
    expect(result.projects[0].id).toBe('web-app')
  })

  it('fetches a run report by convention path', async () => {
    const report = makeReport('2026-01-01', [makeTest('K')])
    const fetchSpy = stubFetch({ 'https://x.test/reports/web-app/2026-01-01.json': report })
    const { getRun } = await loadSource({ baseUrl: 'https://x.test' })

    const result = await getRun('web-app', '2026-01-01')

    expect(fetchSpy).toHaveBeenCalledWith('https://x.test/reports/web-app/2026-01-01.json', expect.anything())
    expect(result.tests[0].testKey).toBe('K')
  })

  it('folds project history client-side from the manifest and run reports', async () => {
    const manifest = makeManifest([makeProject('web-app', [makeRunSummary('r1')])])
    stubFetch({
      'https://x.test/manifest.json': manifest,
      'https://x.test/reports/web-app/r1.json': makeReport('r1', [makeTest('K')]),
    })
    const { getProjectHistory } = await loadSource({ baseUrl: 'https://x.test' })

    const { project, histories } = await getProjectHistory('web-app')

    expect(project?.id).toBe('web-app')
    expect(histories).toHaveLength(1)
    expect(histories[0].testKey).toBe('K')
  })

  it('returns an empty history without fetching runs when the project is missing', async () => {
    const fetchSpy = stubFetch({ 'https://x.test/manifest.json': makeManifest([makeProject('web-app', [makeRunSummary('r1')])]) })
    const { getProjectHistory } = await loadSource({ baseUrl: 'https://x.test' })

    const result = await getProjectHistory('nope')

    expect(result).toEqual({ project: null, histories: [] })
    expect(fetchSpy).toHaveBeenCalledTimes(1) // manifest only, no run fetched
  })
})

describe('restSource', () => {
  it('fetches the api manifest endpoint', async () => {
    const fetchSpy = stubFetch({ 'https://x.test/api/manifest': makeManifest([]) })
    const { getManifest } = await loadSource({ baseUrl: 'https://x.test', mode: 'rest' })

    await getManifest()

    expect(fetchSpy).toHaveBeenCalledWith('https://x.test/api/manifest', expect.anything())
  })

  it('url-encodes project and run ids on the run endpoint', async () => {
    const fetchSpy = stubFetch({ 'https://x.test/api/projects/web%20app/runs/r%2F1': makeReport('r/1', [makeTest('K')]) })
    const { getRun } = await loadSource({ baseUrl: 'https://x.test', mode: 'rest' })

    await getRun('web app', 'r/1')

    expect(fetchSpy).toHaveBeenCalledWith('https://x.test/api/projects/web%20app/runs/r%2F1', expect.anything())
  })

  it('fetches server-computed history instead of folding client-side', async () => {
    const history = { project: makeProject('web-app', []), histories: [] }
    const fetchSpy = stubFetch({ 'https://x.test/api/projects/web-app/tests': history })
    const { getProjectHistory } = await loadSource({ baseUrl: 'https://x.test', mode: 'rest' })

    const result = await getProjectHistory('web-app')

    expect(fetchSpy).toHaveBeenCalledTimes(1) // single request, no per-run fetches
    expect(fetchSpy).toHaveBeenCalledWith('https://x.test/api/projects/web-app/tests', expect.anything())
    expect(result.project?.id).toBe('web-app')
  })
})

describe('fetchJson', () => {
  it('throws with status, statusText and url on a non-ok response', async () => {
    stubFetch({}, { ok: false, status: 404, statusText: 'Not Found' })
    const { getManifest } = await loadSource({ baseUrl: 'https://x.test' })

    await expect(getManifest()).rejects.toThrow('404 Not Found for https://x.test/manifest.json')
  })
})

describe('mock mode', () => {
  it('serves built-in mock data without touching fetch', async () => {
    const fetchSpy = stubFetch({})
    const { getManifest } = await loadSource({ baseUrl: '' }, true)

    const result = await getManifest()

    expect(result.projects.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
