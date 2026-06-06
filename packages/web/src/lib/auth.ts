import { createAuthClient } from 'better-auth/vue'
import { env } from '@/lib/env'

export const authClient = createAuthClient({
  baseURL: env.serverUrl,
})
