import { execSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { sql } from 'drizzle-orm'
import { db } from '../src/db'
import { demo, env, s3 } from '../src/lib/env'
import { logger } from '../src/lib/logger'

// Daily demo refresh (Dokploy schedule): wipe + reseed so the dataset is fresh and run dates
// re-anchor to today. Truncates rather than drops so the live server keeps its connection.
async function main(): Promise<void> {
  if (!demo) {
    logger.error('reset-demo refuses to run without KINORA_DEMO=true (never wipe a real deployment)')
    process.exit(1)
  }
  if (s3)
    logger.warn('reset-demo only clears local STORAGE_DIR; S3 blobs would orphan. Run the demo on FS storage.')

  // Empty every data table (keep schema + knex migration bookkeeping), reset identities.
  const result = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE 'knex_migrations%'
  `)
  const tables = (result.rows as { tablename: string }[]).map(r => `"${r.tablename}"`)
  if (tables.length)
    await db.execute(sql.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`))

  // Drop the now-orphaned trace blobs. Clear the dir's CONTENTS, not the dir itself: STORAGE_DIR
  // is a mounted volume whose mountpoint is root-owned -> removing it would EACCES.
  const artifactsDir = path.resolve(env.STORAGE_DIR)
  if (existsSync(artifactsDir)) {
    for (const entry of readdirSync(artifactsDir))
      rmSync(path.join(artifactsDir, entry), { recursive: true, force: true })
  }

  // Reseed the marketing dataset (run dates are relative to now -> fresh every run).
  execSync('node dist/scripts/seed-market.mjs --force', { stdio: 'inherit', env: process.env })
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err)
    process.exit(1)
  })
