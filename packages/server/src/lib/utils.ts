import { env } from './env'

export function getTrustedOrigins(): string[] {
  const byEnv: Record<typeof env.NODE_ENV, string[]> = {
    production: ['https://app.kinora.dev'],
    development: ['http://localhost:5173'],
  }
  return byEnv[env.NODE_ENV]
}
