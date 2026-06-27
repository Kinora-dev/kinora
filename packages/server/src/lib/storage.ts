import type { Buffer } from 'node:buffer'
import type { S3Config } from './env'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { artifactSignature } from './artifact-url'
import { env, s3 } from './env'

// Local FS (dev/self-host) or any S3-compatible store. url() returns a presigned
// GET so the trace viewer fetches large trace.zip straight from storage (range-capable).
export interface Storage {
  put: (key: string, body: Buffer | Uint8Array) => Promise<void>
  url: (key: string) => Promise<string>
  delete: (key: string) => Promise<void>
}

function localStorage(): Storage {
  const root = resolve(env.STORAGE_DIR)
  // Reject keys that resolve outside STORAGE_DIR (defense in depth against traversal in the key).
  const within = (key: string): string => {
    const dest = resolve(root, key)
    if (dest !== root && !dest.startsWith(root + sep))
      throw new Error('invalid storage key')
    return dest
  }
  return {
    async put(key, body) {
      const dest = within(key)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, body)
    },
    async url(key) {
      return `${env.BASE_URL}/artifacts/${key}?${artifactSignature(key)}`
    },
    async delete(key) {
      // force ignores a missing file, so retention purge stays idempotent.
      await rm(within(key), { force: true })
    },
  }
}

function s3Storage(config: S3Config): Storage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    // Most S3-compatible providers (MinIO, Hetzner) need path-style URLs.
    forcePathStyle: true,
  })
  return {
    async put(key, body) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        CacheControl: 'public, max-age=31536000, immutable',
      }))
    },
    async url(key) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: 3600 })
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    },
  }
}

export const storage: Storage = s3 ? s3Storage(s3) : localStorage()
