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
    include: ['src/**/*.test.ts', 'cli/**/*.test.ts'],
  },
})
