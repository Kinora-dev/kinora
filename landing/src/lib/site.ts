export const SITE = {
  name: 'kinora',
  url: 'https://kinora.dev',
  app: 'https://app.kinora.dev',
  repo: 'https://github.com/Kinora-dev/kinora',
  tagline: 'Playwright test intelligence',
  description:
    'A dashboard for your Playwright tests, across projects and over time, with an embedded trace viewer. Track pass rates, spot trends, surface flaky tests, and open the full trace inline.',
  // Cloud is pre-launch: paid tiers point at a waitlist, enterprise/contact at email.
  waitlist: 'mailto:contact@kinora.dev?subject=kinora%20cloud%20waitlist',
  contact: 'mailto:contact@kinora.dev?subject=kinora%20enterprise',
} as const

export const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Trace viewer', href: '#trace' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Setup', href: '#setup' },
] as const
