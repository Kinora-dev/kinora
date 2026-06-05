import path from 'node:path'
import { defineConfig } from 'vite'

// Aliases mirror upstream Playwright so vendored engine files resolve unedited.
const alias = {
  '@trace': path.resolve(import.meta.dirname, 'src/core/trace'),
  '@isomorphic': path.resolve(import.meta.dirname, 'src/core/isomorphic'),
  '@protocol': path.resolve(import.meta.dirname, 'src/core/protocol'),
}

export default defineConfig({
  base: '',
  resolve: { alias },
  build: { outDir: 'dist' },
})
