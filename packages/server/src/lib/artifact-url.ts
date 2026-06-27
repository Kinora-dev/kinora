import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env'

// Local-FS artifacts are served statically with no auth; sign with HMAC+expiry so only links
// minted by an authed dashboard read are fetchable. Mirrors the S3 presign window (1h).
const ARTIFACT_URL_TTL_MS = 60 * 60 * 1000

function sign(key: string, exp: number): string {
  return createHmac('sha256', env.AUTH_SECRET).update(`${key}:${exp}`).digest('base64url')
}

// `exp`/`sig` query string (no leading `?`) for an artifact key.
export function artifactSignature(key: string): string {
  const exp = Date.now() + ARTIFACT_URL_TTL_MS
  return `exp=${exp}&sig=${sign(key, exp)}`
}

export function verifyArtifactSignature(key: string, exp: string | null | undefined, sig: string | null | undefined): boolean {
  const expNum = Number(exp)
  if (!sig || !Number.isFinite(expNum) || Date.now() > expNum)
    return false
  const expected = Buffer.from(sign(key, expNum))
  const got = Buffer.from(sig)
  return expected.length === got.length && timingSafeEqual(expected, got)
}
