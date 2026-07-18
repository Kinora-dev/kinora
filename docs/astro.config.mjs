// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://docs.kinora.dev',
  integrations: [
    starlight({
      title: 'kinora docs',
      description:
        'Documentation for kinora, the dashboard for Playwright test reports across projects and over time, with an embedded trace viewer.',
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Kinora-dev/kinora' },
      ],
      editLink: {
        baseUrl: 'https://github.com/Kinora-dev/kinora/edit/main/docs/',
      },
      sidebar: [
        { label: 'Introduction', link: '/' },
        { label: 'Getting started', link: '/getting-started/' },
        {
          label: 'Self-hosting',
          items: [
            { label: 'Overview', link: '/self-hosting/' },
            { label: 'Configuration', link: '/self-hosting/configuration/' },
            { label: 'Storage & artifacts', link: '/self-hosting/storage/' },
            { label: 'Upgrading & backups', link: '/self-hosting/upgrading/' },
          ],
        },
      ],
    }),
  ],
})
