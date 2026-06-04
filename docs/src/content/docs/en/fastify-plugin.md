---
title: Fastify Plugin
description: Drop the transform route into your own Fastify app, or write a new adapter.
group: Guide
order: 2
---

# Fastify Plugin

The REST transform ships as a standalone Fastify plugin, `@sharptown/fastify`, built on
top of the framework-agnostic `@sharptown/core` engine. Register it into any Fastify app
to get a `POST /transform` route.

## Register it

```js
import Fastify from 'fastify'
import sharptown from '@sharptown/fastify'

const app = Fastify()
await app.register(sharptown, { prefix: '/api/v1' })
await app.listen({ port: 3001 })

// → POST /api/v1/transform   (multipart file + ?width=500&convertTo=webp)
```

## Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `prefix` | string | `/api/v1` | Route prefix; the route becomes `{prefix}/transform`. |
| `multipart` | object | — | Options forwarded to `@fastify/multipart`. |

The plugin registers `@fastify/multipart` automatically **unless your app already did** —
so it composes cleanly with apps that handle uploads elsewhere.

## What it does

It is a thin adapter over the core engine:

1. Extracts the first uploaded file from the multipart request.
2. Calls `transformBuffer(input, request.query)`.
3. Sends the bytes with the correct `Content-Type`.
4. Maps `InvalidOperationError` → `400`, decode failures → `415`, missing file → `400`.

## Writing a new adapter

Because all imaging lives in `@sharptown/core`, adapters for **Hono, Elysia, Express** and
others are tiny. The contract is always the same four steps:

```js
import { transformBuffer, InvalidOperationError } from '@sharptown/core'

// Pseudocode for any framework:
async function handler(request, reply) {
  const file = await readUploadedFile(request)       // 1. get the bytes
  if (!file) return reply.status(400).json({ error: 'No file uploaded' })

  try {
    const { data, contentType } = await transformBuffer(file, request.query) // 2. transform
    return reply.header('content-type', contentType).send(data)              // 3. respond
  } catch (error) {                                                          // 4. map errors
    if (error instanceof InvalidOperationError) {
      return reply.status(400).json({ error: error.message })
    }
    return reply.status(415).json({ error: 'Unsupported or corrupt image' })
  }
}
```

That parity is the whole point: write the input/output plumbing for your framework, and
the imaging behavior comes for free from the shared core.
