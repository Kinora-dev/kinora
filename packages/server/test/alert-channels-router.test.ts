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
