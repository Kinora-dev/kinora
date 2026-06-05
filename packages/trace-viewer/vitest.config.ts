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
  },
})
