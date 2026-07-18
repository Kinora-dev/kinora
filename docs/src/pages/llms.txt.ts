import type { APIRoute } from 'astro'
import { hrefFor, NAV } from '../lib/nav'
import { SITE } from '../lib/site'

export const GET: APIRoute = () => {
  const url = SITE.url

  const sections = NAV.map((group) => {
    const items = group.items
      .map(it => `- [${it.label}](${url}${hrefFor(it.slug)})`)
      .join('\n')
    return group.label ? `## ${group.label}\n${items}` : items
  }).join('\n\n')

  const body = `# kinora docs

> Documentation for kinora, the dashboard for Playwright test reports across projects and over time, with an embedded trace viewer. CI runs push their results to kinora; it tracks pass rates, trends, and flaky tests, and opens the full Playwright trace inline for any failure.

${sections}

## Links
- Website: ${SITE.home}
- App (sign up / log in): ${SITE.app}
- Live demo: ${SITE.demo}
- GitHub: ${SITE.repo}
`

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
