---
title: Deployment
description: Ship Sharptown with Docker, docker compose, and nginx / Caddy reverse proxies.
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

## Run with docker compose

`docker-compose.yml` defines three services: `rest` (3001), `grpc` (50051) and
`jsonrpc` (3002).

```bash
cp .env.example .env   # optional; compose works without it
```

### Run a single service

The service name comes **after** `up`. The flags are `-d` (detached) and, the first time,
`--build`:

```bash
docker compose up -d rest        # REST only        → :3001
docker compose up -d grpc        # gRPC only        → :50051
docker compose up -d jsonrpc     # JSON-RPC only    → :3002
```

> Note the order: it is `docker compose up -d <service>`, not `docker compose <service> -d`.
> Use `up --build -d <service>` to (re)build the image first.

### Run all three

```bash
docker compose up --build -d     # rest + grpc + jsonrpc
```

### Manage running services

```bash
docker compose ps                # what is running
docker compose logs -f grpc      # follow one service's logs
docker compose stop jsonrpc      # stop one service
docker compose down              # stop & remove everything
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

## Reverse proxy

In production you typically put each service behind a reverse proxy that terminates TLS.
The three transports have **different requirements**: REST is plain HTTP (mind the upload
size), JSON-RPC needs the WebSocket upgrade, and gRPC needs HTTP/2. Pick the section for
the service you are exposing.

### REST (HTTP, `:3001`)

Uploads can be large, so raise the request-body limit.

**nginx**

```nginx
server {
  listen 80;
  server_name images.example.com;

  client_max_body_size 100m;   # allow large image uploads

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Caddy** (auto-provisions TLS)

```caddy
images.example.com {
  request_body {
    max_size 100MB
  }
  reverse_proxy 127.0.0.1:3001
}
```

### JSON-RPC (WebSocket, `:3002`)

The endpoint is `/rpc` and rides a WebSocket, so forward the `Upgrade`/`Connection`
headers and use generous timeouts so idle sockets are not cut.

**nginx**

```nginx
server {
  listen 80;
  server_name rpc.example.com;

  location /rpc {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host       $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

**Caddy** (WebSockets work out of the box)

```caddy
rpc.example.com {
  reverse_proxy 127.0.0.1:3002
}
```

### gRPC (HTTP/2, `:50051`)

gRPC requires **HTTP/2**. The Sharptown gRPC server is plaintext (`createInsecure`), so the
proxy speaks HTTP/2 cleartext (h2c) to the backend while terminating TLS on the client
side.

**nginx** (TLS terminates here; upstream is `grpc://`, not `grpcs://`)

```nginx
server {
  listen 443 ssl http2;
  server_name grpc.example.com;

  ssl_certificate     /etc/ssl/grpc.crt;
  ssl_certificate_key /etc/ssl/grpc.key;

  client_max_body_size 0;     # gRPC streams; no fixed body limit
  grpc_read_timeout  3600s;
  grpc_send_timeout  3600s;

  location / {
    grpc_pass grpc://127.0.0.1:50051;
  }
}
```

**Caddy** (`h2c://` = cleartext HTTP/2 to the backend)

```caddy
grpc.example.com {
  reverse_proxy h2c://127.0.0.1:50051
}
```

Point gRPC clients at the proxy's TLS endpoint (port `443`) with the matching credentials,
e.g. `grpc.credentials.createSsl()` instead of `createInsecure()`.

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
