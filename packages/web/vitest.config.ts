import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(new URL('./src', import.meta.url).pathname),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Unit-test scope = pure lib logic; components/composables/router are covered by the e2e suite.
      include: ['src/lib/**/*.ts'],
      // Glue, not our logic: env reads import.meta.env; auth/trpc construct clients; cn wraps clsx+tailwind-merge.
      exclude: ['src/lib/env.ts', 'src/lib/auth.ts', 'src/lib/trpc.ts', 'src/lib/utils.ts'],
      reporter: ['text-summary', 'text', 'html'],
      // Regression floor for the lib logic (small surface, so kept a few points under current).
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 80,
        lines: 85,
      },
    },
  },
})
