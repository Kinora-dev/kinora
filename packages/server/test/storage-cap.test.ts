import type { Entitlements } from '../src/billing/entitlements'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Tests run self-host (unlimited), so pin a tiny cap and re-import the graph with it.
const CAP = 5
const capped: Entitlements = { tier: 'free', maxProjects: 1, retentionDays: 7, includedResults: 2500, storageBytes: CAP, alerts: false }

vi.mock('../src/billing/entitlements', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/billing/entitlements')>()),
  getEntitlements: async () => capped,
}))
vi.resetModules()

const { app } = await import('../src/app')
const { db } = await import('../src/db')
const { env } = await import('../src/lib/env')
const { createApiKey, createUser, ingest, resetDb } = await import('./helpers')

beforeEach(resetDb)

async function upload(runId: string, apiKey: string, bytes: number) {
  const form = new FormData()
  form.set('file', new File([new Uint8Array(bytes)], 'trace.zip'))
  form.set('name', 'trace')
  return app.request(`/api/v1/runs/${runId}/artifacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
}

async function seedRun(): Promise<{ runId: string, apiKey: string }> {
  const user = await createUser()
  const apiKey = await createApiKey(user.id)
  await ingest(apiKey)
  return { runId: (await db.query.run.findMany())[0].id, apiKey }
}

describe('artifact storage cap', () => {
  it('accepts uploads up to the plan limit', async () => {
    const { runId, apiKey } = await seedRun()
    expect((await upload(runId, apiKey, 4)).status).toBe(201)
    expect(await db.query.artifact.findMany()).toHaveLength(1)
  })

  it('rejects the upload that would cross the limit and keeps no orphan blob', async () => {
    const { runId, apiKey } = await seedRun()
    expect((await upload(runId, apiKey, 4)).status).toBe(201)

    const res = await upload(runId, apiKey, 4) // 4 + 4 > 5
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ limit: CAP, error: expect.stringContaining('storage') })

    const stored = await db.query.artifact.findMany()
    expect(stored).toHaveLength(1) // only the first upload survived
    expect(existsSync(resolve(env.STORAGE_DIR, stored[0].storageKey))).toBe(true)
    // The rejected bytes left nothing behind: the run prefix holds just the accepted blob.
    const runDir = resolve(env.STORAGE_DIR, stored[0].storageKey, '..')
    expect(await readdir(runDir)).toHaveLength(1)
  })

  it('rejects without reading the body once the workspace is full', async () => {
    const { runId, apiKey } = await seedRun()
    expect((await upload(runId, apiKey, 5)).status).toBe(201)

    expect((await upload(runId, apiKey, 1)).status).toBe(402)
    expect(await db.query.artifact.findMany()).toHaveLength(1)
  })
})
