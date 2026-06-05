import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { absoluteUrl, alternateUrls } from '../lib/seo'
import type { Locale } from '../i18n/ui'

export const prerender = true

type SitemapPage = {
  path: string
  locale: Locale
  changefreq: 'weekly' | 'monthly'
  priority: string
}

export const GET: APIRoute = async () => {
  const docs = await getCollection('docs')
  const pages: SitemapPage[] = [
    { path: '/', locale: 'en', changefreq: 'weekly', priority: '1.0' },
    { path: '/', locale: 'ru', changefreq: 'weekly', priority: '1.0' },
    { path: '/playground', locale: 'en', changefreq: 'monthly', priority: '0.7' },
    { path: '/playground', locale: 'ru', changefreq: 'monthly', priority: '0.7' },
    ...docs.map((entry) => {
      const [locale, ...slugParts] = entry.id.split('/')

      return {
        path: `/docs/${slugParts.join('/')}`,
        locale: locale as Locale,
        changefreq: 'weekly' as const,
        priority: slugParts.join('/') === 'grpc-api' ? '0.9' : '0.8',
      }
    }),
  ]

  const urls = pages.map((page) => {
    const links = alternateUrls(page.path)
      .map((alternate) => (
        `<xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${escapeXml(alternate.url)}" />`
      ))
      .join('')

    return [
      '<url>',
      `<loc>${escapeXml(absoluteUrl(page.path, page.locale))}</loc>`,
      links,
      `<changefreq>${page.changefreq}</changefreq>`,
      `<priority>${page.priority}</priority>`,
      '</url>',
    ].join('')
  }).join('')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    },
  )
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
