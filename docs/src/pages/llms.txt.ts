import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { absoluteUrl, SITE_NAME, SITE_URL } from '../lib/seo'
import type { Locale } from '../i18n/ui'

export const prerender = true

export const GET: APIRoute = async () => {
  const docs = await getCollection('docs')
  const groupOrder = ['Introduction', 'Guide', 'Transports', 'Recipes', 'Operations']
  const byLocale = (locale: Locale) => docs
    .filter((entry) => entry.id.startsWith(`${locale}/`))
    .sort((a, b) => {
      const groupDelta = groupOrder.indexOf(a.data.group) - groupOrder.indexOf(b.data.group)

      return groupDelta || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title)
    })
    .map((entry) => {
      const slug = entry.id.slice(`${locale}/`.length)
      const description = entry.data.description ? `: ${entry.data.description}` : ''

      return `- [${entry.data.title}](${absoluteUrl(`/docs/${slug}`, locale)})${description}`
    })
    .join('\n')

  const body = [
    `# ${SITE_NAME}`,
    '',
    '> Self-hosted image transformation and image processing service built on Fastify, Sharp/libvips, REST, gRPC streaming, and JSON-RPC.',
    '',
    `Website: ${SITE_URL}`,
    `Repository: https://github.com/e1berd/sharptown`,
    `Playground: ${absoluteUrl('/playground', 'en')}`,
    `Russian playground: ${absoluteUrl('/playground', 'ru')}`,
    '',
    '## What Sharptown Is',
    '',
    'Sharptown is a developer-facing image transformation service. It resizes, crops, converts, optimizes, blurs, rotates, tints, changes alpha, and streams large image files without buffering the whole file in memory. It exposes REST, bidirectional gRPC, and JSON-RPC transports over a shared Sharp-based core.',
    '',
    'Russian summary: Sharptown - сервис обработки изображений на своем сервере. Ключевые темы: gRPC обработка изображений, потоковая трансформация изображений, REST API для конвертации изображений, Sharp/libvips, Fastify plugin.',
    '',
    '## Recommended Starting Points',
    '',
    `- [Introduction](${absoluteUrl('/docs/introduction', 'en')})`,
    `- [gRPC image processing API](${absoluteUrl('/docs/grpc-api', 'en')})`,
    `- [Введение](${absoluteUrl('/docs/introduction', 'ru')})`,
    `- [gRPC обработка изображений](${absoluteUrl('/docs/grpc-api', 'ru')})`,
    `- [Operations reference](${absoluteUrl('/docs/operations', 'en')})`,
    `- [Справочник операций](${absoluteUrl('/docs/operations', 'ru')})`,
    '',
    '## English Documentation',
    '',
    byLocale('en'),
    '',
    '## Russian Documentation',
    '',
    byLocale('ru'),
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
