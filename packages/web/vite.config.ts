import path from 'node:path'
import { ValidateEnv } from '@julr/vite-plugin-validate-env'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { z } from 'zod'

export default defineConfig({
  plugins: [
    ValidateEnv({
      validator: 'standard',
      schema: {
        VITE_KINORA_SERVER_URL: z.url(),
        VITE_KINORA_VIEWER_URL: z.string().optional(),
        VITE_KINORA_CLOUD: z.string().optional(),
        VITE_KINORA_SENTRY_DSN: z.string().optional(),
      },
    }),
    vue(),
    tailwindcss(),
  ],
  server: { port: 5173 },
  resolve: {
    alias: {
      '@': path.resolve(new URL('./src', import.meta.url).pathname),
    },
  },
})
