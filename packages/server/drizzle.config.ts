import { defineConfig } from 'drizzle-kit'
import { env } from './src/lib/env'
import 'dotenv/config'

const pgUrl = `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schemas/index.ts',
  dialect: 'postgresql',
  dbCredentials: { url: pgUrl },
})
