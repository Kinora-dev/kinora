import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Built to home/dist, served by the loopback server under /home/.
export default defineConfig({
  root: import.meta.dirname,
  base: '/home/',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
