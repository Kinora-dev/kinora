import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'scripts/migrate.ts', 'scripts/purge-expired-runs.ts', 'migrations/*.ts'],
  platform: 'node',
  format: 'esm',
  // Bundle the workspace lib (its in-repo exports point at TS source) so the
  // built server runs in prod without resolving @kinora/core from node_modules.
  deps: { alwaysBundle: ['@kinora/core'] },
})
