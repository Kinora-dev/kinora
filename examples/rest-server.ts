#!/usr/bin/env -S npx tsx
/* eslint-disable no-console */
import type { RunReport } from '@kinora/core'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { serve } from '@hono/node-server'
import {
  buildTestHistories,
  manifestSchema,
  runReportSchema,
} from '@kinora/core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Reference REST server for kinora's `rest` mode. Reads a CLI output dir
// (manifest.json + reports/) and serves the same contract over /api/*, with
// per-test history computed server-side. Reference only.
//
//   npx tsx examples/rest-server.ts [dataDir=kinora-data] [port=8787]

const dataDir = path.resolve(process.argv[2] ?? 'kinora-data')
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

const app = new Hono()

app.use('/api/*', cors()) // dev convenience; tighten in production

app.get('/api/manifest', async c => c.json(await loadManifest()))

app.get('/api/projects/:projectId/runs/:runId', async (c) => {
  const { projectId, runId } = c.req.param()
  return c.json(await loadRun(projectId, runId))
})

app.get('/api/projects/:projectId/tests', async (c) => {
  const projectId = c.req.param('projectId')
  const manifest = await loadManifest()
  const project = manifest.projects.find(x => x.id === projectId) ?? null
  if (!project)
    return c.json({ project: null, histories: [] })
  const reports = await Promise.all(project.runs.map(r => loadRun(projectId, r.runId)))
  return c.json({ project, histories: buildTestHistories(reports) })
})

app.notFound(c => c.json({ error: `no route for ${c.req.path}` }, 404))
app.onError((err, c) => c.json({ error: String(err) }, 500))

serve({ fetch: app.fetch, port }, () => {
  console.log(`kinora reference REST server on http://localhost:${port} (data: ${dataDir})`)
})
