import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '../src/db'
import { organization } from '../src/db/schemas/index'
import { adminOverview, listAccounts, runsPerDay, signupsPerWeek } from '../src/reports/admin-queries'
import { caller, createApiKey, createUser, ingest, ownedOrgId, runPayload } from './helpers'

describe('admin analytics queries', () => {
  it('adminOverview counts users, accounts, projects, and recent activity', async () => {
    const a = await createUser('owner-a@test.dev')
    await createUser('owner-b@test.dev')
    const key = await createApiKey(a.id)
    await ingest(key, runPayload('web-app'))
    await ingest(key, runPayload('web-app'))

    const o = await adminOverview()
    expect(o.users).toBe(2)
    expect(o.accounts).toBe(2)
    expect(o.projects).toBe(1)
    expect(o.testResults30d).toBe(2)
    expect(o.activeAccounts).toBe(1)
    expect(o.newUsers7d).toBe(2)
  })

  it('listAccounts returns one row per org with owner, plan, projects, lastRun', async () => {
    const a = await createUser('owner@test.dev')
    await createUser('idle@test.dev')
    const key = await createApiKey(a.id)
    await ingest(key, runPayload('web-app'))

    const rows = await listAccounts()
    expect(rows).toHaveLength(2)

    // Active account sorts first (has a lastRunAt); idle account last (null).
    const active = rows[0]
    const idle = rows[1]
    expect(active.ownerEmail).toBe('owner@test.dev')
    expect(active.members).toBe(1)
    expect(active.plan).toBe('free')
    expect(active.projects).toBe(1)
    expect(active.lastRunAt).not.toBeNull()

    expect(idle.ownerEmail).toBe('idle@test.dev')
    expect(idle.projects).toBe(0)
    expect(idle.lastRunAt).toBeNull()
  })

  it('listAccounts sorts by lastRunAt desc, nulls last', async () => {
    const a = await createUser('sort-a@test.dev')
    const b = await createUser('sort-b@test.dev')
    await createUser('sort-c@test.dev') // never ran (null)
    await createUser('sort-d@test.dev') // never ran (null) -> exercises the equal-null branch
    await ingest(await createApiKey(a.id), runPayload('web-app'))
    await ingest(await createApiKey(b.id), runPayload('web-app')) // later run -> strict order vs a

    const rows = await listAccounts()
    const emails = rows.map(r => r.ownerEmail)
    const ranMax = Math.max(emails.indexOf('sort-a@test.dev'), emails.indexOf('sort-b@test.dev'))
    const nullMin = Math.min(emails.indexOf('sort-c@test.dev'), emails.indexOf('sort-d@test.dev'))
    expect(ranMax).toBeLessThan(nullMin) // both ran accounts precede both null ones
    expect(rows.find(r => r.ownerEmail === 'sort-c@test.dev')?.lastRunAt).toBeNull()
  })

  it('time-series bucket the window by signup and run date', async () => {
    const a = await createUser('series@test.dev')
    const key = await createApiKey(a.id)
    await ingest(key, runPayload('web-app'))
    await ingest(key, runPayload('web-app'))

    const signups = await signupsPerWeek()
    expect(signups.reduce((s, b) => s + b.count, 0)).toBe(1)

    const runs = await runsPerDay()
    expect(runs.reduce((s, b) => s + b.count, 0)).toBe(2)
  })

  it('excludes internal orgs and their owners from every metric', async () => {
    const ext = await createUser('ext@test.dev')
    const int = await createUser('dogfood@test.dev')
    await ingest(await createApiKey(ext.id), runPayload('web-app'))
    await ingest(await createApiKey(int.id), runPayload('web-app'))
    await db.update(organization).set({ internal: true }).where(eq(organization.id, await ownedOrgId(int.id)))

    const o = await adminOverview()
    expect(o.users).toBe(1) // internal org owner excluded
    expect(o.accounts).toBe(1)
    expect(o.activeAccounts).toBe(1)
    expect(o.testResults30d).toBe(1)

    const rows = await listAccounts()
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerEmail).toBe('ext@test.dev')

    const runs = await runsPerDay()
    expect(runs.reduce((s, b) => s + b.count, 0)).toBe(1) // internal run excluded
  })
})

describe('platformAdminProcedure gate', () => {
  it('is hidden (NOT_FOUND) on self-host where cloud is off', async () => {
    // Test env runs KINORA_CLOUD=false, so the cloud gate fires before the role check.
    const u = await createUser('nobody@test.dev')
    const trpc = await caller(u, await ownedOrgId(u.id))
    await expect(trpc.admin.overview()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
