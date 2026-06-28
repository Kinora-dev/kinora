import { beforeEach, describe, expect, it } from 'vitest'
import { caller, createApiKey, createUser, ingest, resetDb } from './helpers'

beforeEach(resetDb)

// Create the 'web-app' project for the user's org so ownedProject resolves.
async function seedProject(userId: string): Promise<void> {
  const key = await createApiKey(userId)
  await ingest(key)
}

describe('alerts.addChannel validation', () => {
  it('rejects an http webhook URL (https required)', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)

    await expect(
      api.alerts.addChannel({ projectId: 'web-app', kind: 'webhook', target: 'http://example.com/hook', policy: 'on-failure' }),
    ).rejects.toThrow(/HTTPS/)
  })

  it('rejects an invalid email address', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)

    await expect(
      api.alerts.addChannel({ projectId: 'web-app', kind: 'email', target: 'not-an-email', policy: 'on-failure' }),
    ).rejects.toThrow(/email/i)
  })

  it('accepts an https webhook URL', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)

    await api.alerts.addChannel({ projectId: 'web-app', kind: 'webhook', target: 'https://example.com/hook', policy: 'always' })

    const channels = await api.alerts.channels({ projectId: 'web-app' })
    expect(channels).toHaveLength(1)
    expect(channels[0]?.kind).toBe('webhook')
  })
})

describe('alerts channel lifecycle', () => {
  it('adds, updates, and removes an email channel', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)

    await api.alerts.addChannel({ projectId: 'web-app', kind: 'email', target: 'alerts@team.dev', policy: 'on-failure' })
    const id = (await api.alerts.channels({ projectId: 'web-app' }))[0]!.id

    await api.alerts.updateChannel({ id, policy: 'always', enabled: false })
    const updated = (await api.alerts.channels({ projectId: 'web-app' }))[0]!
    expect(updated.policy).toBe('always')
    expect(updated.enabled).toBe(false)

    await api.alerts.removeChannel({ id })
    expect(await api.alerts.channels({ projectId: 'web-app' })).toHaveLength(0)
  })

  it('cannot touch a channel from another org (NOT_FOUND)', async () => {
    const a = await createUser('a@test.dev')
    await seedProject(a.id)
    const apiA = await caller(a)
    await apiA.alerts.addChannel({ projectId: 'web-app', kind: 'email', target: 'x@team.dev', policy: 'always' })
    const id = (await apiA.alerts.channels({ projectId: 'web-app' }))[0]!.id

    const b = await createUser('b@test.dev')
    await expect((await caller(b)).alerts.removeChannel({ id })).rejects.toThrow(/not found/i)
  })

  it('testChannel delivers a sample to an email channel', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)
    await api.alerts.addChannel({ projectId: 'web-app', kind: 'email', target: 'alerts@team.dev', policy: 'always' })
    const id = (await api.alerts.channels({ projectId: 'web-app' }))[0]!.id

    await expect(api.alerts.testChannel({ id })).resolves.toEqual({ ok: true })
  })
})

describe('alerts slack integration', () => {
  it('upsert creates a slack integration that get returns', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)
    await api.alerts.upsert({ projectId: 'web-app', webhookUrl: 'https://hooks.slack.com/services/T/B/x', policy: 'on-failure', enabled: true })

    const got = await api.alerts.get({ projectId: 'web-app' })
    expect(got?.policy).toBe('on-failure')
    expect(got?.enabled).toBe(true)
  })

  it('updateSettings is NOT_FOUND without an integration, ok after upsert', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)

    await expect(api.alerts.updateSettings({ projectId: 'web-app', policy: 'always', enabled: false })).rejects.toThrow(/no slack integration/i)
    await api.alerts.upsert({ projectId: 'web-app', webhookUrl: 'https://hooks.slack.com/services/T/B/x', policy: 'always', enabled: true })
    await expect(api.alerts.updateSettings({ projectId: 'web-app', policy: 'on-regression', enabled: false })).resolves.toEqual({ ok: true })
  })

  it('disconnect removes the slack integration', async () => {
    const user = await createUser()
    await seedProject(user.id)
    const api = await caller(user)
    await api.alerts.upsert({ projectId: 'web-app', webhookUrl: 'https://hooks.slack.com/services/T/B/x', policy: 'always', enabled: true })

    await api.alerts.disconnect({ projectId: 'web-app' })
    expect(await api.alerts.get({ projectId: 'web-app' })).toBeNull()
  })
})
