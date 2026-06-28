import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // kinora.ts is the argv/CLI entrypoint (process exit + stdout wiring), exercised by usage, not units.
      exclude: ['src/kinora.ts'],
      reporter: ['text-summary', 'text', 'html'],
      // Floor reflects current: the trace-upload loop in upload.ts needs fs mocking to exercise (low value).
      thresholds: {
        statements: 80,
        branches: 55,
        functions: 80,
        lines: 80,
      },
    },
  },
})
