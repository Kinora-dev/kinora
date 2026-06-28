import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'scripts/migrate.ts', 'scripts/purge-expired-runs.ts', 'scripts/reset-demo.ts', 'scripts/seed-market.ts', 'migrations/*.ts'],
  platform: 'node',
  format: 'esm',
  // Source maps so Sentry stack traces map back to TS (run with node --enable-source-maps).
  sourcemap: true,
  // Bundle the workspace lib (its in-repo exports point at TS source) so the
  // built server runs in prod without resolving @kinora/core from node_modules.
  deps: { alwaysBundle: ['@kinora/core'] },
})
