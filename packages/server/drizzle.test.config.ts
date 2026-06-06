import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

// Schema push for the integration test DB. Reads only POSTGRES_* from the env that
// global-setup passes in (not the strict app env), always targeting kinora_test.
const url = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/kinora_test`

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schemas/index.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
})
