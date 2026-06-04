# @sharptown/fastify-plugin

A [Fastify](https://fastify.dev) plugin that exposes Sharptown's image transform over a
single REST route, built on [`@sharptown/core`](../core). It is a thin adapter: file
extraction + response wiring only — all imaging lives in the core.

## Install

```bash
pnpm add @sharptown/fastify-plugin fastify
```

## Usage

```js
import Fastify from 'fastify'
import sharptown from '@sharptown/fastify-plugin'

const app = Fastify()
await app.register(sharptown, { prefix: '/api/v1' }) // prefix is optional

await app.listen({ port: 3001 })
```

This registers:

```
POST {prefix}/transform   (multipart upload, query = operations)
```

The plugin registers `@fastify/multipart` itself (unless the host already did). Send the
image as a multipart file field; pass operations as query parameters:

```bash
curl -F image=@input.jpg \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" -o out.webp
```

Operations match `@sharptown/core`: `width`, `height`, `rotate`, `flip`, `blur`,
`r`/`g`/`b`, `grayscale`/`greyscale`, `removeAlpha`, `ensureAlpha`, `convertTo`.

On success the response is the binary image with the correct `content-type`
(e.g. `image/webp`). Invalid options return `400 { error }`; an unreadable image returns
`415 { error }`.

## Building other adapters

This plugin is the reference for the core contract. A Hono, Elysia or Express adapter
follows the same four steps — extract the file as a `Buffer`, call
`transformBuffer(buffer, query)`, send `data` with `contentType`, map
`InvalidOperationError` to `400`. See [`@sharptown/core`](../core#writing-a-new-adapter).

## License

MIT
