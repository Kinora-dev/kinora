import { beforeEach } from 'vitest'
import { resetDb } from './helpers'

// Runs after setup-env, so importing helpers (-> db -> env.ts) sees the test env.
beforeEach(async () => {
  await resetDb()
})
