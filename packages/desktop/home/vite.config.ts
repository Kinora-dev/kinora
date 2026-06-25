import path from 'node:path'
import process from 'node:process'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Built to home/dist, served by the loopback server under /home/.
export default defineConfig({
  root: import.meta.dirname,
  base: '/home/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Maps emitted only for the Sentry upload; the plugin deletes them after.
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
  },
  plugins: [
    vue(),
    tailwindcss(),
    // Uploads source maps + injects debug IDs. Skipped without an auth token (dev builds).
    process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          // Delete maps after upload so they never ship in the packaged app.
          sourcemaps: { filesToDeleteAfterUpload: ['./home/dist/**/*.map'] },
        })
      : undefined,
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
