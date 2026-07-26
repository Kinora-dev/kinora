import type { APIRoute } from 'astro'

// Explicit groups: a UA-specific group makes a crawler ignore `*`, so state the allow.
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'Bytespider',
  'cohere-ai',
  'DuckAssistBot',
  'YouBot',
]

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://kinora.dev')).origin

  const body = `User-agent: *
Allow: /

${AI_AGENTS.map(ua => `User-agent: ${ua}`).join('\n')}
Allow: /

# LLM-readable summaries: ${origin}/llms.txt and ${origin}/llms-full.txt
Sitemap: ${origin}/sitemap-index.xml
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
