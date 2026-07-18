// @ts-check
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://docs.kinora.dev',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
  markdown: {
    shikiConfig: {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
