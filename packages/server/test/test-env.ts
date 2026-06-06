import type { Env } from '../src/lib/env'
import process from 'node:process'

// Self-contained env for integration tests: no .env needed. Typed against Env so
// every required key is set. Only the Postgres connection has to be real (dev
// compose defaults; override via process.env in CI). POSTGRES_DB is pinned to
// kinora_test so the dev DB is never reachable; the rest are throwaway values.
export const TEST_ENV: Record<keyof Env, string> = {
  NODE_ENV: 'development',
  PORT: '3000',
  BASE_URL: 'http://localhost:3000',
  AUTH_SECRET: 'integration-tests-secret-not-used-for-anything-real',
  POSTGRES_USER: process.env.POSTGRES_USER ?? 'kinora',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? 'kinora',
  POSTGRES_HOST: process.env.POSTGRES_HOST ?? 'localhost',
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? '5436',
  POSTGRES_DB: 'kinora_test',
  STORAGE_DIR: '.data/test-artifacts',
  GOOGLE_CLIENT_ID: 'test',
  GOOGLE_CLIENT_SECRET: 'test',
  GITHUB_CLIENT_ID: 'test',
  GITHUB_CLIENT_SECRET: 'test',
}
