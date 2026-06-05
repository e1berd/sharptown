import type { Locale } from '../i18n/ui'
import { defaultLocale, locales } from '../i18n/ui'
import { REPO_URL, SOURCECRAFT_URL } from './links'

export const SITE_URL = 'https://sharptown.dev'
export const SITE_NAME = 'Sharptown'

export function absoluteUrl(path: string, locale: Locale = defaultLocale): string {
  const cleanPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  const localizedPath = locale === defaultLocale ? cleanPath : `/${locale}${cleanPath}`

  return new URL(localizedPath || '/', SITE_URL).toString()
}

export function alternateUrls(path: string): Array<{ locale: Locale | 'x-default'; url: string }> {
  return [
    ...locales.map((locale) => ({ locale, url: absoluteUrl(path, locale) })),
    { locale: 'x-default' as const, url: absoluteUrl(path, defaultLocale) },
  ]
}

export function ogLocale(locale: Locale): string {
  return locale === 'ru' ? 'ru_RU' : 'en_US'
}

export function baseJsonLd(locale: Locale, path: string, title: string, description: string): Array<Record<string, unknown>> {
  return [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: locale,
      description,
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: [REPO_URL, SOURCECRAFT_URL],
    },
    {
      '@type': 'WebPage',
      '@id': `${absoluteUrl(path, locale)}#webpage`,
      url: absoluteUrl(path, locale),
      name: title,
      description,
      inLanguage: locale,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ]
}

export function jsonLdGraph(nodes: Array<Record<string, unknown>>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes,
  })
}
