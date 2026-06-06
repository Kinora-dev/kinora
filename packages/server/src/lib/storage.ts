import type { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { env } from './env'

// Local-FS object storage. Swap for S3/R2 (MinIO in self-host compose) later;
// callers only depend on this interface.
export interface Storage {
  put: (key: string, body: Buffer | Uint8Array) => Promise<void>
  url: (key: string) => string
}

const root = resolve(env.STORAGE_DIR)

export const storage: Storage = {
  async put(key, body) {
    const dest = join(root, key)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, body)
  },
  url(key) {
    return `${env.BASE_URL}/artifacts/${key}`
  },
}
