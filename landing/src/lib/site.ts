export const SITE = {
  name: 'kinora',
  url: 'https://kinora.dev',
  app: 'https://app.kinora.dev',
  login: 'https://app.kinora.dev/login',
  signup: 'https://app.kinora.dev/signup',
  repo: 'https://github.com/Kinora-dev/kinora',
  selfhost: 'https://github.com/Kinora-dev/kinora/tree/main/selfhost',
  download: 'https://github.com/Kinora-dev/kinora/releases/latest',
  tagline: 'Playwright test intelligence',
  description:
    'A dashboard for your Playwright tests, across projects and over time, with an embedded trace viewer. Track pass rates, spot trends, surface flaky tests, and open the full trace inline.',
  contact: 'mailto:contact@kinora.dev?subject=kinora%20enterprise',
} as const

export const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Trace viewer', href: '#trace' },
  { label: 'Desktop', href: '#desktop' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Setup', href: '#setup' },
] as const
