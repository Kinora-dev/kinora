import type { IngestRun } from '@kinora/core'
import type { AuthType } from '../src/lib/auth'
import { makeTestKey } from '@kinora/core'
import { sql } from 'drizzle-orm'
import { app } from '../src/app'
import { db } from '../src/db'
import { auth } from '../src/lib/auth'
import { appRouter } from '../src/router/index'

const TABLES = ['artifact', 'test', 'run', 'project', 'apikey', 'verification', 'account', 'session', 'user']

export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`))
}

export async function createUser(email = 'user@test.dev') {
  const res = await auth.api.signUpEmail({ body: { email, password: 'password123', name: email } })
  return res.user
}

export async function createApiKey(userId: string): Promise<string> {
  const res = await auth.api.createApiKey({ body: { name: 'integration', userId } })
  return res.key
}

export function caller(user: { id: string }) {
  return appRouter.createCaller({ user: user as AuthType['user'], req: new Request('http://test') })
}

export async function ingest(key: string | null, payload: IngestRun = runPayload()) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key)
    headers.Authorization = `Bearer ${key}`
  return app.request('/api/v1/runs', { method: 'POST', headers, body: JSON.stringify(payload) })
}

export function runPayload(slug = 'web-app', tag = '@smoke'): IngestRun {
  const file = 'tests/checkout.spec.ts'
  const titlePath = [file, 'completes a purchase']
  return {
    project: { slug, name: slug },
    run: {
      startedAt: new Date().toISOString(),
      duration: 1234,
      counts: { total: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    },
    tests: [{
      testKey: makeTestKey(file, titlePath, 'chromium'),
      title: 'completes a purchase',
      titlePath,
      file,
      line: 12,
      column: 3,
      projectName: 'chromium',
      status: 'expected',
      ok: true,
      duration: 1234,
      retries: 0,
      tags: [tag],
      annotations: [],
      errors: [],
      attachments: [],
    }],
  }
}
