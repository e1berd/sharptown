---
title: Deployment
description: Ship Sharptown with Docker and docker-compose.
group: Recipes
order: 2
---

# Deployment

Each server host has its own Dockerfile, built from the **repo root** as context (so the
workspace packages resolve correctly).

## Build a single host

```bash
docker build -f packages/server-rest/Dockerfile -t sharptown-rest .
docker run -p 3001:3001 -d sharptown-rest
```

## docker-compose — all three transports

`docker-compose.yml` defines three services: `rest` (3001), `grpc` (50051) and
`jsonrpc` (3002).

```bash
cp .env.example .env            # optional; compose works without it
docker compose up --build rest  # REST only
docker compose up --build       # all three
```

Inside containers the bind host is forced to `0.0.0.0` so each service is reachable, and
ports are overridable via the same `SHARPTOWN_*` variables:

```yaml
services:
  rest:
    build: { context: ., dockerfile: packages/server-rest/Dockerfile }
    ports: ["${SHARPTOWN_PORT:-3001}:3001"]
    environment: { SHARPTOWN_PORT: 3001, SHARPTOWN_HOST: 0.0.0.0 }
    restart: unless-stopped
  # grpc → 50051, jsonrpc → 3002 follow the same shape
```

## Production without Docker

Every server package has a `prod` script (`node <entry>.mjs`) and a `prod:env` variant
that loads `.env`:

```bash
pnpm install
pnpm build                                   # emit type declarations
pnpm --filter @sharptown/server-rest prod:env
```

## Deploying these docs (static, no VDS)

This documentation site is built with Astro in its default **static (SSG)** mode, so
`astro build` emits plain HTML/CSS/JS into `docs/dist/`. Host it on any static provider —
no server required:

```bash
pnpm --filter @sharptown/docs build   # → docs/dist
```

Upload `docs/dist/` to Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront,
or any static host / CDN.

> **GitHub Pages note.** If you deploy under a sub-path
> (e.g. `https://user.github.io/sharptown/`), set `base: '/sharptown/'` in
> `docs/astro.config.mjs`. Every internal link in this site already respects
> `import.meta.env.BASE_URL`, so it will keep working under a sub-path.

## Operational notes

- Sharptown is **stateless** — scale horizontally behind a load balancer with no shared
  state to coordinate.
- For very large inputs, prefer the [gRPC host](/docs/grpc-api) so files stream instead of
  buffering.
- Mind output-format pixel limits when converting huge images — see the
  [Operations reference](/docs/operations#big-file-limits-streaming--grpc).
