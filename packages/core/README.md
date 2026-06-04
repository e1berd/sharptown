# @sharptown/core

The **framework-agnostic** image transformation engine behind Sharptown, powered by
[Sharp](https://sharp.pixelplumbing.com). It knows nothing about HTTP or any web
framework — every server adapter (Fastify, gRPC, JSON-RPC, and any you add for Hono /
Elysia / Express) is built on top of it.

## API

```js
import {
  transformBuffer,
  createTransformStream,
  applyOperations,
  SUPPORTED_FORMATS,
  InvalidOperationError,
  mimeTypeFor,
} from '@sharptown/core'
```

### `transformBuffer(input, options) → Promise<{ data, format, contentType }>`
Buffered transform. `input` is a `Buffer`/`Uint8Array`/`ArrayBuffer`. The output `format`
comes from Sharp itself, so `contentType` is correct even without an explicit `convertTo`.

```js
const { data, contentType } = await transformBuffer(buffer, { width: 200, convertTo: 'webp' })
```

### `createTransformStream(options) → sharp.Sharp`
A configured Sharp duplex stream for arbitrary-size files (`sequentialRead`, no input-pixel
limit). Pipe bytes in, read transformed bytes out — used by the gRPC streaming host.

### `applyOperations(sharpInstance, options) → sharp.Sharp`
The shared operation applier. Validates values and throws `InvalidOperationError` on bad
input. Accepts both numbers and query-style strings.

Recognised options: `width`, `height`, `rotate`, `flip`, `blur`, `r`/`g`/`b` (tint, 0–255),
`grayscale`/`greyscale`, `removeAlpha`, `ensureAlpha`, `convertTo` (one of `SUPPORTED_FORMATS`).

## Writing a new adapter

An adapter only has to:
1. Extract the uploaded image as a `Buffer` (or stream) and the options object.
2. Call `transformBuffer` (buffered) or `createTransformStream` (streaming).
3. Send `data` with the returned `contentType`.
4. Map `InvalidOperationError` to a client error (HTTP 400, gRPC `INVALID_ARGUMENT`, JSON-RPC `-32602`).

That contract is exactly how `@sharptown/fastify`, `@sharptown/server-grpc` and
`@sharptown/server-jsonrpc` are implemented.

## License

MIT
