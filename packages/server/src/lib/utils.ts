import { env } from './env'

export function getTrustedOrigins(): string[] {
  const byEnv: Record<typeof env.NODE_ENV, string[]> = {
    production: ['https://kinora.dev'],
    development: ['*'],
  }
  return byEnv[env.NODE_ENV]
}
