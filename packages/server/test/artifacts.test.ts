import { Buffer } from 'node:buffer'
import { resolve, sep } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { db } from '../src/db'
import { env } from '../src/lib/env'
import { storage } from '../src/lib/storage'
import { createApiKey, createUser, ingest, resetDb } from './helpers'

beforeEach(resetDb)

const root = resolve(env.STORAGE_DIR)

async function uploadArtifact(key: string, name: string) {
  const user = await createUser()
  const apiKey = await createApiKey(user.id)
  await ingest(apiKey)
  const run = (await db.query.run.findMany())[0]

  const form = new FormData()
  form.set('file', new File([new Uint8Array([0x50, 0x4B, 0x03, 0x04])], 'trace.zip'))
  form.set('name', name)
  const res = await app.request(`/api/v1/runs/${run.id}/artifacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  return { res, run }
}

describe('artifact upload', () => {
  it('sanitizes a traversal name so the stored key stays under the run prefix', async () => {
    const { res, run } = await uploadArtifact('k', '../../../../../../tmp/pwned')
    expect(res.status).toBe(201)

    const a = (await db.query.artifact.findMany())[0]
    // key shape is `${projectId}/${runId}/${uuid}-${name}.zip`: exactly 3 path segments, no escape.
    expect(a.storageKey.startsWith(`${run.projectId}/${run.id}/`)).toBe(true)
    expect(a.storageKey.split('/')).toHaveLength(3)
    expect(resolve(root, a.storageKey).startsWith(root + sep)).toBe(true)
  })
})

describe('local storage guard', () => {
  it('rejects a relative key that escapes the storage root', async () => {
    await expect(storage.put('../escape.zip', Buffer.from('x'))).rejects.toThrow('invalid storage key')
  })

  it('rejects an absolute key', async () => {
    await expect(storage.put('/tmp/escape.zip', Buffer.from('x'))).rejects.toThrow('invalid storage key')
  })
})
