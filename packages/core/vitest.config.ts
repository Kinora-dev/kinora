import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Barrel export + static label map (no logic to unit-test).
      exclude: ['src/index.ts', 'src/lib/status.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: {
        statements: 92,
        branches: 78,
        functions: 90,
        lines: 92,
      },
    },
  },
})
