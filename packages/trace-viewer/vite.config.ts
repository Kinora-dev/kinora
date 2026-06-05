import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Aliases mirror upstream Playwright so vendored engine files resolve unedited.
const alias = {
  '@trace': path.resolve(import.meta.dirname, 'src/core/trace'),
  '@isomorphic': path.resolve(import.meta.dirname, 'src/core/isomorphic'),
  '@protocol': path.resolve(import.meta.dirname, 'src/core/protocol'),
  '@': path.resolve(import.meta.dirname, 'src'),
}

export default defineConfig({
  base: '',
  // Dedicated port so the service worker always lives on its own origin,
  // separate from the dashboard app (5173).
  server: { port: 5174 },
  plugins: [vue(), tailwindcss()],
  resolve: { alias },
  build: { outDir: 'dist' },
})
