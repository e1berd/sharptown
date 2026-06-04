import en from './en.yaml'
import ru from './ru.yaml'

/** Supported locales. The first entry is the default (served unprefixed). */
export const locales = ['en', 'ru'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

const dictionaries: Record<Locale, Record<string, unknown>> = { en, ru }

/** Human-readable name of each locale, for the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: (en as { localeName: string }).localeName,
  ru: (ru as { localeName: string }).localeName,
}

/**
 * Extracts the active locale from a URL pathname. `/ru/...` → `ru`, everything else → `en`.
 */
export function getLocale(pathname: string): Locale {
  const segment = pathname.replace(/^\/+/, '').split('/')[0]
  return locales.includes(segment as Locale) ? (segment as Locale) : defaultLocale
}

/**
 * Returns a translator bound to a locale. Keys are dot-paths into the YAML dictionary
 * (e.g. `t('nav.docs')`). Falls back to English, then to the key itself.
 */
export function useTranslations(locale: Locale) {
  return function t<T = string>(key: string): T {
    return (lookup(dictionaries[locale], key) ?? lookup(dictionaries[defaultLocale], key) ?? key) as T
  }
}

/** Returns the whole translation tree for a locale (handy for passing to islands). */
export function messages(locale: Locale): Record<string, unknown> {
  return dictionaries[locale]
}

/**
 * Builds a locale-aware, BASE_URL-aware path. The default locale is unprefixed; others get
 * a `/<locale>` prefix. Pass a leading-slash path like `/docs/introduction`.
 */
export function localizedPath(path: string, locale: Locale): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const clean = path === '/' ? '' : path
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  return `${base}${prefix}${clean}` || '/'
}

function lookup(dict: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}
