export const SITE = {
  name: 'kinora',
  url: 'https://kinora.dev',
  repo: 'https://github.com/Kinora-dev/kinora',
  tagline: 'Playwright test intelligence',
  description:
    'A dashboard for your Playwright tests, across projects and over time, with an embedded trace viewer. Track pass rates, spot trends, surface flaky tests, and open the full trace inline.',
} as const

export const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Trace viewer', href: '#trace' },
  { label: 'Setup', href: '#setup' },
] as const
