import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const body = `User-agent: *
Allow: /

Sitemap: ${new URL('sitemap.xml', site ?? 'https://kinora.dev')}
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } })
}
