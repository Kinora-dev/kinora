// @ts-check
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

/** @type {{ re: RegExp, priority: number }[]} */
const PRIORITY = [
  { re: /\/(?:privacy|terms|contact)$/, priority: 0.3 },
  { re: /\/vs\/[^/]+$/, priority: 0.8 },
  { re: /\/vs$/, priority: 0.7 },
]

export default defineConfig({
  site: 'https://kinora.dev',
  // Canonical URLs have no trailing slash; keeps sitemap and <link rel=canonical> identical.
  trailingSlash: 'never',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      serialize(item) {
        const { pathname, origin } = new URL(item.url)
        if (pathname === '/') {
          item.url = `${origin}/`
          item.priority = 1
        }
        else {
          item.priority = PRIORITY.find(p => p.re.test(pathname))?.priority ?? 0.9
        }
        return item
      },
    }),
  ],
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
  },
})
