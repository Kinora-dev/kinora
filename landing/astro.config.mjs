// @ts-check
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://kinora.dev',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
  },
})
