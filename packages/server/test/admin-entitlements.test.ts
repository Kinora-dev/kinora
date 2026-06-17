import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { ownerIsAdmin } from '../src/billing/entitlements'
import { db } from '../src/db'
import { user } from '../src/db/schemas/index'
import { createUser, ownedOrgId } from './helpers'

describe('ownerIsAdmin (admin cap bypass)', () => {
  it('is false for a regular owner', async () => {
    const u = await createUser('regular@test.dev')
    expect(await ownerIsAdmin(await ownedOrgId(u.id))).toBe(false)
  })

  it('is true when the org owner has the admin role', async () => {
    const u = await createUser('admin@test.dev')
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, u.id))
    expect(await ownerIsAdmin(await ownedOrgId(u.id))).toBe(true)
  })
})
