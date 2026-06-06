import { createAuthClient } from 'better-auth/vue'
import { config } from '@/config'

export const authClient = createAuthClient({
  baseURL: config.serverUrl,
})
