---
title: Getting Started
description: Install the monorepo and run your first transform in under a minute.
group: Introduction
order: 2
---

# Getting Started

Sharptown is a [pnpm](https://pnpm.io) workspace. You will have a server running and your
first optimized image in about a minute.

## Prerequisites

- **Node.js ≥ 18** (the repo is developed on Node 24).
- **pnpm** (`npm i -g pnpm`).

## Install

```bash
git clone https://github.com/e1berd/sharptown.git
cd sharptown
pnpm install          # installs every workspace
cp .env.example .env  # optional — sensible defaults are built in
```

## Run a server

Each transport is an independent package with its own script:

```bash
pnpm dev        # REST server in watch mode      → http://localhost:3001
pnpm grpc       # gRPC streaming server           → 0.0.0.0:50051
pnpm jsonrpc    # JSON-RPC over WebSocket server   → ws://localhost:3002/rpc
pnpm build      # emit type declarations for all packages
```

The three transports are **independent server packages**, all sharing
`@sharptown/core`. Run one, or run all three.

## Your first transform (REST)

With the REST server running, optimize an image to WebP with a single `curl`:

```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" \
  --output out.webp
```

On success you get the **binary image** back, with the correct `Content-Type`
(`image/webp` here). On error you get JSON:

```json
{ "error": "Unsupported format" }
```

## Your first transform (JS client)

Prefer code? The client makes it expressive and chainable:

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')

const webp = await st
  .transform(file)   // a File, Blob, Buffer, URL or path
  .resize(800, 600)
  .blur(3)
  .grayscale()
  .convert('webp')   // resolves to a Blob

// In the browser:
document.querySelector('img').src = URL.createObjectURL(webp)
```

## Try it live

The [Playground](/playground) builds these chains for you and runs them against a server
URL you provide — a quick way to feel the API before writing code.

## Next steps

- [Configuration](/docs/configuration) — environment variables and ports.
- [REST API](/docs/rest-api) — the full endpoint contract.
- [Deployment](/docs/deployment) — Docker and docker-compose.
