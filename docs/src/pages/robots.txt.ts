import type { APIRoute } from 'astro'
import { SITE_URL } from '../lib/seo'

export const prerender = true

export const GET: APIRoute = () => new Response(
  [
    'User-agent: *',
    'Allow: /',
    '',
    `Host: ${new URL(SITE_URL).host}`,
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `LLMs: ${SITE_URL}/llms.txt`,
    '',
  ].join('\n'),
  {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  },
)
