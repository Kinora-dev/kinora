import { execSync } from 'node:child_process'
import process from 'node:process'

// Recreate + seed the disposable e2e DB (dev + CI). Run BEFORE playwright boots the stack,
// so the server connects to a ready DB and nothing drops it out from under a live connection.
const env = { ...process.env, POSTGRES_DB: 'kinora_e2e', KINORA_CLOUD: 'false' }
const opts = { stdio: 'inherit' as const, env }

execSync('pnpm exec tsx scripts/db-create.ts', opts)
execSync('pnpm exec tsx scripts/migrate.ts latest', opts)
execSync('pnpm exec tsx scripts/seed.ts', opts)
