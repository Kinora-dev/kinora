#!/usr/bin/env -S npx tsx
/* eslint-disable no-console */
import type { RunReport } from '../src/contracts/playback'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import {
  manifestSchema,
  runReportSchema,
} from '../src/contracts/playback'
import { buildTestHistories } from '../src/lib/history'

// Reference REST server for playback's `rest` mode. Reads a CLI output dir
// (manifest.json + reports/) and serves the same contract over /api/*, with
// per-test history computed server-side. Zero dependencies. Reference only.
//
//   npx tsx examples/rest-server.ts [dataDir=playback-data] [port=8787]

const dataDir = path.resolve(process.argv[2] ?? 'playback-data')
const port = Number(process.argv[3] ?? 8787)

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(dataDir, file), 'utf8'))
}

async function loadManifest() {
  return manifestSchema.parse(await readJson('manifest.json'))
}

async function loadRun(projectId: string, runId: string): Promise<RunReport> {
  return runReportSchema.parse(await readJson(`reports/${projectId}/${runId}.json`))
}

const server = createServer((req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*', // dev convenience; tighten in production
    })
    res.end(JSON.stringify(body))
  }

  void (async () => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const p = url.pathname

      if (p === '/api/manifest')
        return send(200, await loadManifest())

      let m = p.match(/^\/api\/projects\/([^/]+)\/runs\/(.+)$/)
      if (m)
        return send(200, await loadRun(decodeURIComponent(m[1]), decodeURIComponent(m[2])))

      m = p.match(/^\/api\/projects\/([^/]+)\/tests$/)
      if (m) {
        const projectId = decodeURIComponent(m[1])
        const manifest = await loadManifest()
        const project = manifest.projects.find(x => x.id === projectId) ?? null
        if (!project)
          return send(200, { project: null, histories: [] })
        const reports = await Promise.all(project.runs.map(r => loadRun(projectId, r.runId)))
        return send(200, { project, histories: buildTestHistories(reports) })
      }

      send(404, { error: `no route for ${p}` })
    }
    catch (err) {
      send(500, { error: String(err) })
    }
  })()
})

server.listen(port, () => {
  console.log(`playback reference REST server on http://localhost:${port} (data: ${dataDir})`)
})
