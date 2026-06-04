import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import yaml from '@rollup/plugin-yaml'

/**
 * Sharptown documentation site. Astro + Markdown content collections, with a single
 * Vue island for the interactive transform playground. No React anywhere.
 *
 * i18n: English (default, unprefixed) and Russian (`/ru/...`). UI strings live in YAML
 * (`src/i18n/*.yaml`), imported through `@rollup/plugin-yaml`.
 *
 * @see https://docs.astro.build/en/reference/configuration-reference/
 */
export default defineConfig({
  site: 'https://sharptown.dev',
  i18n: {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [vue()],
  vite: {
    plugins: [yaml()],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
})
