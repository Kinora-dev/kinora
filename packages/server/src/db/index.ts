import { drizzle } from 'drizzle-orm/node-postgres'
import { env } from '../lib/env'
import * as schema from './schemas/index'

export const db = drizzle({
  schema,
  connection: {
    user: env.POSTGRES_USER,
    host: env.POSTGRES_HOST,
    database: env.POSTGRES_DB,
    password: env.POSTGRES_PASSWORD,
    port: env.POSTGRES_PORT,
    // Bound the pool: cap connections, fail fast when the pool is exhausted instead of hanging,
    // and let Postgres abort a runaway query so it can't pin a connection forever.
    max: 10,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  },
})
