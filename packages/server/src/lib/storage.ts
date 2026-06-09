import type { Buffer } from 'node:buffer'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { env } from './env'

export interface Storage {
  put: (key: string, body: Buffer | Uint8Array) => Promise<void>
  url: (key: string) => string
  delete: (key: string) => Promise<void>
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
  async delete(key) {
    // force ignores a missing file, so retention purge stays idempotent.
    await rm(join(root, key), { force: true })
  },
}
