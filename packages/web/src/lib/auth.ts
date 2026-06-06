import { apiKeyClient } from '@better-auth/api-key/client'
import { createAuthClient } from 'better-auth/vue'
import { env } from '@/lib/env'

export const authClient = createAuthClient({
  baseURL: env.serverUrl,
  plugins: [apiKeyClient()],
})
