---
title: Introduction
description: What Sharptown is, who it is for, and why it exists.
group: Introduction
order: 1
---

# Introduction

**Sharptown** is a high-performance image transformation and conversion service built on
[Fastify](https://fastify.dev) and [Sharp](https://sharp.pixelplumbing.com) (libvips).
It lets you **resize, rotate, blur, grayscale, tint, control alpha, and convert formats**
— all on the fly through a simple API.

## Why Sharptown exists

The primary goal is dead simple: **let users easily turn their photos into an optimized
format** — for example `webp` or `avif` — so images ship fewer bytes over the wire.

In other words, the core purpose is **image delivery optimization**:

- Smaller payloads → faster page loads and better Core Web Vitals.
- Lower bandwidth and CDN costs.
- Modern formats (WebP, AVIF, HEIF) without forcing your source files to change.
- On-demand transforms, so you store one original and derive every variant.

> Upload a heavy `.jpg`, ask for `?width=800&convertTo=webp`, and get back a small,
> web-ready image. That is the everyday job Sharptown is built for.

## More than a converter: build a full photo editor

Optimized delivery is the foundation — but it is not the ceiling.

Because Sharptown ships a **running server** plus an expressive **JavaScript client**
(`@sharptown/client`, currently JS-only), you have everything you need to build a
**complete in-browser photo editor** on top of it:

- The browser sends the user's image and a chain of operations to a running Sharptown
  server.
- The server does the heavy pixel work with Sharp and streams the result back.
- Your UI shows a live preview, lets the user tweak parameters, and exports the final
  image.

So Sharptown can be two things at once:

1. A **CDN-style optimizer** sitting in front of your image delivery.
2. The **backend engine of a real editor**, where resize/blur/tint/convert become the
   editing toolbox.

See [Building a photo editor](/docs/building-an-editor) for a worked example.

## What's in the box

| Package | Role |
| ------- | ---- |
| `@sharptown/core` | Framework-agnostic Sharp engine, shared by every adapter. |
| `@sharptown/fastify` | Fastify plugin exposing `POST /transform`. |
| `@sharptown/client` | Expressive isomorphic JS client (browser / Node / Bun / Deno). |
| `@sharptown/server-rest` | REST host (Fastify + plugin + static UI). |
| `@sharptown/server-grpc` | gRPC bidirectional-streaming host. |
| `@sharptown/server-jsonrpc` | JSON-RPC 2.0 over WebSocket host. |

Three transports, **one shared engine**. Pick the one that fits your stack — or run all
three side by side.

## Where to go next

- [Getting started](/docs/getting-started) — install and run a server in a minute.
- [Architecture](/docs/architecture) — how the monorepo fits together.
- [JS client](/docs/js-client) — the expressive, chainable browser/Node client.
- [Operations reference](/docs/operations) — every transform parameter in one table.
