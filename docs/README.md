# @sharptown/docs

The Sharptown documentation site — built with [Astro](https://astro.build) and Markdown
content collections, with a single Vue island for the interactive transform playground.
**No React.**

It is a fully **static (SSG)** site: `astro build` emits plain HTML/CSS/JS, so it can be
hosted on any static provider (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CDN)
with no server / VDS.

**i18n:** English (default, served unprefixed) and Russian (`/ru/...`). UI strings live in
YAML (`src/i18n/en.yaml`, `src/i18n/ru.yaml`); docs content is split per locale under
`src/content/docs/en` and `src/content/docs/ru`.

## Develop

```bash
pnpm --filter @sharptown/docs dev      # dev server with HMR
pnpm --filter @sharptown/docs build    # static build → docs/dist
pnpm --filter @sharptown/docs preview  # preview the built site
```

From the repo root you can also use the shortcut `pnpm docs`.

## Structure

```
docs/
├── astro.config.mjs            # Astro + Vue + YAML, i18n config, Shiki themes
├── src/
│   ├── content/docs/
│   │   ├── en/*.md             # English docs (content collection)
│   │   └── ru/*.md             # Russian docs
│   ├── content.config.ts       # collection schema (title, group, order)
│   ├── i18n/
│   │   ├── en.yaml / ru.yaml   # UI strings (YAML)
│   │   └── ui.ts               # t(), locale detection, localizedPath()
│   ├── pages/
│   │   ├── index.astro         # en landing       (ru: pages/ru/index.astro)
│   │   ├── playground.astro    # en playground    (ru: pages/ru/playground.astro)
│   │   └── docs/[...slug].astro# en docs           (ru: pages/ru/docs/[...slug].astro)
│   ├── layouts/                # BaseLayout + DocsLayout (sidebar + TOC)
│   ├── components/             # Header, ThemeToggle, LangSwitcher, Landing, Playground.vue
│   ├── lib/nav.ts, links.ts    # locale-aware sidebar; external links
│   └── styles/global.css       # angular yellow/dark theme, dashed focus
```

## Adding a page

Create the **same-named** Markdown file in both `src/content/docs/en/` and
`src/content/docs/ru/` with frontmatter:

```md
---
title: My Page
description: One-line summary.
group: Guide          # sidebar section — keep the English key in BOTH locales
order: 3              # position within the section
---

# My Page
```

The `group` value stays in English (it is the sort/translation key); the displayed section
title is translated via `groups.*` in the YAML files. The sidebar and routes update
automatically. Add new UI strings to `src/i18n/en.yaml` and `src/i18n/ru.yaml`.

## Theming

The theme is angular (zero border-radius), yellow accent over dark/light tones, with
dashed focus rings. Light/dark is toggled via the header switch and persisted in
`localStorage`. Tokens live as CSS variables in `src/styles/global.css`.

## Deploying under a sub-path

For GitHub Pages project sites, set `base: '/sharptown/'` in `astro.config.mjs`. All
internal links use `import.meta.env.BASE_URL`, so they keep working under a sub-path.
