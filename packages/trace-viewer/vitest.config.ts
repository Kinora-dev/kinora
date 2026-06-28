import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Aliases mirror upstream Playwright so vendored engine files resolve unedited.
export default defineConfig({
  resolve: {
    alias: {
      '@trace': path.resolve(import.meta.dirname, 'src/core/trace'),
      '@isomorphic': path.resolve(import.meta.dirname, 'src/core/isomorphic'),
      '@protocol': path.resolve(import.meta.dirname, 'src/core/protocol'),
    },
  },
  test: {
    environment: 'node',
    // Unit tests only; e2e/*.spec.ts is run by Playwright, not vitest.
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Our pure UI helpers; vendored engine (src/core, src/sw) is upstream, and snapshots/
      // useKeyboardNav are Vue/trace-model bound (exercised by the e2e suite, not units).
      include: ['src/ui/lib/format.ts', 'src/ui/lib/network.ts', 'src/ui/lib/sha1.ts', 'src/ui/lib/action.ts', 'src/ui/lib/attachments.ts', 'src/ui/lib/timeline.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
})
