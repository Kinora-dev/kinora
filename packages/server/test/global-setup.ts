import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { TEST_ENV } from './test-env'

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Create the dedicated test database (separate from the dev `kinora` DB) and push
// the Drizzle schema into it once, before any test runs.
export default async function setup(): Promise<void> {
  const admin = new Client({
    user: TEST_ENV.POSTGRES_USER,
    password: TEST_ENV.POSTGRES_PASSWORD,
    host: TEST_ENV.POSTGRES_HOST,
    port: Number(TEST_ENV.POSTGRES_PORT),
    database: 'postgres',
  })
  await admin.connect()
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_ENV.POSTGRES_DB])
  if (!rowCount)
    await admin.query(`CREATE DATABASE ${TEST_ENV.POSTGRES_DB}`)
  await admin.end()

  // Dedicated config targets kinora_test and skips the strict app env (env.ts).
  execSync('pnpm exec drizzle-kit push --force --config drizzle.test.config.ts', {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, ...TEST_ENV },
  })
}
