---
title: Architecture
description: How the monorepo, the shared core, and the transport adapters fit together.
group: Introduction
order: 3
---

# Architecture

Sharptown is a pnpm monorepo built around one principle: **all image work lives in a
single framework-agnostic engine, and every transport is a thin adapter on top of it.**

## The big picture

```
                ┌─────────────────────────────┐
                │      @sharptown/core         │
                │   Sharp engine (libvips)     │
                │  applyOperations / transform │
                └──────────────┬──────────────┘
                               │ reused by every adapter
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
┌───────▼────────┐   ┌─────────▼─────────┐   ┌─────────▼──────────┐
│ @sharptown/    │   │ @sharptown/       │   │ @sharptown/        │
│   fastify      │   │   server-grpc     │   │  server-jsonrpc    │
│ REST plugin    │   │ streaming host    │   │ WS JSON-RPC host   │
└───────┬────────┘   └───────────────────┘   └────────────────────┘
        │
┌───────▼────────┐                         ┌────────────────────┐
│ @sharptown/    │   ◀──── HTTP ────▶       │  @sharptown/client │
│  server-rest   │                         │  isomorphic JS     │
└────────────────┘                         └────────────────────┘
```

## The core engine — `@sharptown/core`

The heart of the project. It depends on **no web framework**; it just knows how to drive
Sharp. Two entry points cover both processing styles:

- **`transformBuffer(input, options)`** — transforms an in-memory buffer and returns
  `{ data, format, contentType }`. Used by REST and JSON-RPC.
- **`createTransformStream(options)`** — returns a Sharp duplex stream configured for
  arbitrary-size files (`sequentialRead`, no input-pixel limit). Used by gRPC.

Both funnel through **`applyOperations(image, options)`**, the one function that maps your
parameters (`width`, `blur`, `convertTo`, …) onto Sharp calls. Because every adapter
reuses it, the behavior is identical no matter which transport you hit.

```js
import { transformBuffer } from '@sharptown/core'

const { data, contentType } = await transformBuffer(inputBuffer, {
  width: 800,
  convertTo: 'webp',
})
```

Invalid values raise an **`InvalidOperationError`**, which each adapter maps to its own
error convention (HTTP 400, gRPC `INVALID_ARGUMENT`, JSON-RPC `-32602`).

## The transport adapters

| Adapter | Style | Best for |
| ------- | ----- | -------- |
| **REST** (`@sharptown/fastify` → `server-rest`) | `multipart` upload, binary response | Web apps, CDNs, `curl`, the JS client. |
| **gRPC** (`server-grpc`) | Bidirectional streaming | Huge files, service-to-service, backpressure. |
| **JSON-RPC** (`server-jsonrpc`) | JSON-RPC 2.0 over WebSocket, base64 | Persistent socket apps, batching, notifications. |

Each adapter is small precisely because the core does the real work. Adding a new one
(Hono, Elysia, Express…) means: read the input, call `transformBuffer`, send the bytes,
map `InvalidOperationError` to an error.

## The client — `@sharptown/client`

An isomorphic JS client that runs in the browser, Node, Bun and Deno. It speaks the REST
transport by default, with a **pluggable transport** interface so other transports can be
added later. See [JS client](/docs/js-client).

## Design choices worth knowing

- **Self-documenting code, JSDoc on the public API.** Every exported function carries an
  `@example`.
- **Streaming never buffers whole files.** The gRPC path pipes chunks straight into Sharp
  and out again, so memory stays flat even for multi-gigabyte inputs.
- **Format detection from Sharp's own output.** The response `Content-Type` is correct
  even when you do not pass `convertTo`.
