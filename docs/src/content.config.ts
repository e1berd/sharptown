import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

/**
 * The `docs` collection — every Markdown file under `src/content/docs`. The numeric
 * `order` drives the sidebar; `group` buckets pages into sidebar sections.
 */
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    group: z.string().default('Guide'),
    order: z.number().default(99),
  }),
})

export const collections = { docs }
