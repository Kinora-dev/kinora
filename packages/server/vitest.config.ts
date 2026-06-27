import { defineConfig } from 'vitest/config'

// Integration tests run against a real Postgres in a dedicated DB (kinora_test),
// created + schema-pushed by globalSetup. The dev DB (kinora) is never touched.
// setup-env populates process.env (no .env needed) before setup-db imports the app.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts', './test/setup-db.ts'],
    // One shared DB + truncate-per-test: keep files serial to avoid cross-test races.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Declarative/entrypoint/non-test-graph files: can't or shouldn't be unit-covered.
      exclude: ['src/db/schemas/**', 'src/index.ts', 'src/instrument.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'text', 'html'],
    },
  },
})
