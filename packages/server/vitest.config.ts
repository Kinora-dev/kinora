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
      // Declarative/entrypoint/non-test-graph + cloud-SDK glue that needs a live Polar to exercise.
      // admin.ts: thin cloud-gated router wrappers (platformAdminProcedure NOT_FOUND when cloud=false),
      // unreachable in the test env; the logic lives in reports/admin-queries.ts which is tested.
      exclude: ['src/db/schemas/**', 'src/index.ts', 'src/instrument.ts', 'src/billing/polar.ts', 'src/router/admin.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'text', 'html'],
      // Regression floor, ~1-2pt under current (81/72/84/81); ratchet up as coverage grows.
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 82,
        lines: 80,
      },
    },
  },
})
