import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { TEST_ENV } from './test-env'

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Recreate the dedicated test DB and run the knex migrations
// into it once, before any test runs. A fresh DB each run also
// validates the migrations against the same schema tests exercise.
export default async function setup(): Promise<void> {
  const admin = new Client({
    user: TEST_ENV.POSTGRES_USER,
    password: TEST_ENV.POSTGRES_PASSWORD,
    host: TEST_ENV.POSTGRES_HOST,
    port: Number(TEST_ENV.POSTGRES_PORT),
    database: 'postgres',
  })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_ENV.POSTGRES_DB} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${TEST_ENV.POSTGRES_DB}`)
  await admin.end()

  execSync('pnpm migrate latest', {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, ...TEST_ENV },
  })
}
