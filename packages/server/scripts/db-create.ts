import process from 'node:process'
import { Client } from 'pg'

// Drop + recreate the database named by POSTGRES_DB (used to give e2e a disposable DB).
async function main(): Promise<void> {
  const name = process.env.POSTGRES_DB
  if (!name)
    throw new Error('POSTGRES_DB is required')

  const admin = new Client({
    user: process.env.POSTGRES_USER ?? 'kinora',
    password: process.env.POSTGRES_PASSWORD ?? 'kinora',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? '5436'),
    database: 'postgres',
  })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${name}`)
  await admin.end()
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
