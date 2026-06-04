import { getCollection } from 'astro:content'
import type { Locale } from '../i18n/ui'

/** A single sidebar link. `slug` excludes the locale prefix (e.g. `introduction`). */
export interface NavItem {
  slug: string
  title: string
  order: number
}

/** A sidebar section grouping ordered pages. `group` is the canonical (English) key. */
export interface NavGroup {
  group: string
  items: NavItem[]
}

const GROUP_ORDER = ['Introduction', 'Guide', 'Transports', 'Recipes', 'Operations']

/**
 * Builds the docs sidebar for a locale from the `docs` content collection. Entry ids are
 * `<locale>/<slug>`; this filters by locale, strips the prefix, groups by `group` and
 * sorts by `order`. Computed at build time, so the output stays fully static.
 */
export async function getNavGroups(locale: Locale): Promise<NavGroup[]> {
  const entries = await getCollection('docs')
  const byGroup = new Map<string, NavItem[]>()

  for (const entry of entries) {
    if (!entry.id.startsWith(`${locale}/`)) continue
    const item: NavItem = {
      slug: entry.id.slice(locale.length + 1),
      title: entry.data.title,
      order: entry.data.order,
    }
    const list = byGroup.get(entry.data.group) ?? []
    list.push(item)
    byGroup.set(entry.data.group, list)
  }

  return [...byGroup.entries()]
    .map(([group, items]) => ({ group, items: items.sort((a, b) => a.order - b.order) }))
    .sort((a, b) => groupRank(a.group) - groupRank(b.group))
}

function groupRank(group: string): number {
  const index = GROUP_ORDER.indexOf(group)
  return index === -1 ? GROUP_ORDER.length : index
}
