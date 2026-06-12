import { env } from './env'

export function getTrustedOrigins(): string[] {
  return [env.WEB_ORIGIN]
}
