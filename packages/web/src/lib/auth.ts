import { apiKeyClient } from '@better-auth/api-key/client'
import { polarClient } from '@polar-sh/better-auth/client'
import { lastLoginMethodClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { env } from '@/lib/env'

export const authClient = createAuthClient({
  baseURL: env.serverUrl,
  plugins: [apiKeyClient(), lastLoginMethodClient(), polarClient()],
})
