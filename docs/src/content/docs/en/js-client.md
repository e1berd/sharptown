---
title: JS Client
description: The expressive, chainable, isomorphic client for browser, Node, Bun and Deno.
group: Guide
order: 1
---

# JS Client

`@sharptown/client` is an expressive, **isomorphic** client — it runs unchanged in the
browser, Node, Bun and Deno. It speaks the REST transport by default, with a pluggable
transport interface so other transports can be added later.

It is the only client published to npm. Prefer another language? See the
[PHP](/docs/php-client), [Go](/docs/go-client) and [Elixir](/docs/elixir-client) clients.

## Create a client

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')
```

`sharptown(url, options?)` accepts a string or `URL`, plus options:

| Option | Type | Default | Purpose |
| ------ | ---- | ------- | ------- |
| `transport` | `Transport` | `rest()` | Pluggable transport. |
| `fetch` | `function` | `globalThis.fetch` | Custom fetch (Node < 18, proxies, tests). |
| `headers` | `object` | `{}` | Default headers on every request (e.g. auth). |

## The transform chain

`st.transform(input)` returns a chainable **`TransformBuilder`**. Every operation method
returns `this`, so you can fluently compose a pipeline and finish with a terminal.

```js
const blob = await st
  .transform(file)
  .resize(800, 600)
  .blur(3)
  .grayscale()
  .convert('webp')   // await resolves to a Blob
```

### Accepted inputs

`transform(input)` takes any of:

- `Blob` / `File` — used as-is.
- `ArrayBuffer`, `Uint8Array`, any `TypedArray` / `DataView` (including Node `Buffer`).
- `ReadableStream` — a web stream.
- `string` — an `http(s)://…` URL (fetched) **or** a file path (Node/Bun/Deno).
- `URL` — an `http(s):` or `file:` URL.

### Operation methods

Resize & crop:

| Method | Description |
| ------ | ----------- |
| `.resize(width, height?)` | Resize. Also accepts `{ width, height }`. |
| `.width(n)` / `.height(n)` | Set one dimension. |
| `.crop(x, y, w, h)` | Crop a rectangle. Also accepts `{ left, top, width, height }`. |
| `.smartCrop(enabled = true)` | Crop to the salient region when resizing. |
| `.fit(mode)` | `cover` / `contain` / `fill` / `inside` / `outside`. |
| `.background(color)` | Background for `fit: 'contain'`. |
| `.dpr(value)` | Device pixel ratio; multiplies the target size. |
| `.aspectRatio(ratio)` | Target ratio; combine with `.width()`/`.height()`. |
| `.autoOrient(enabled = true)` | Rotate by EXIF orientation. |
| `.rotate(deg)` | Rotate by degrees. |
| `.flip(enabled = true)` | Flip horizontally. |

Tone, color & effects:

| Method | Description |
| ------ | ----------- |
| `.brightness(n)` | Brightness `-100`–`100`. |
| `.contrast(n)` | Contrast `-100`–`100`. |
| `.saturation(n)` | Saturation `0`–`2`. |
| `.exposure(n)` | Exposure in EV `-3`–`3`. |
| `.hue(n)` | Hue rotation `0`–`360`. |
| `.gamma(n)` | Gamma `1.0`–`3.0`. |
| `.colorize(color)` | Map to shades of one colour. |
| `.tint(r, g, b)` | Tint. Also accepts `{ r, g, b }`. |
| `.grayscale(enabled = true)` | Desaturate (`.greyscale` is an alias). |
| `.blur(sigma = 1)` | Gaussian blur. |
| `.sharpen(sigma?)` | Sharpen; no argument uses the default. |
| `.sepia(intensity = 1)` | Sepia `0`–`1`. |
| `.invert(enabled = true)` | Invert colours. |
| `.threshold(n)` | Binarise at `0`–`255`. |
| `.oilPaint(size = 3)` | Oil-paint (median) effect. |

Alpha & output:

| Method | Description |
| ------ | ----------- |
| `.removeAlpha()` / `.ensureAlpha()` | Alpha control. |
| `.quality(n)` | Output quality `1`–`100` (with `.convert()`). |
| `.progressive(enabled = true)` | Progressive output. |
| `.stripMetadata(enabled = true)` | Strip EXIF (default); `false` keeps it. |
| `.convert(format)` | Output format (`.toFormat` is an alias). |
| `.abortWith(signal)` | Attach an `AbortSignal`. |

Validation happens **client-side, before the request** — bad values throw a
`SharptownError` immediately.

### Terminals

The builder is *thenable*: `await builder` resolves to a `Blob`. Or finish explicitly:

| Terminal | Returns |
| -------- | ------- |
| `await builder` / `.blob()` | `Blob` |
| `.arrayBuffer()` | `ArrayBuffer` |
| `.bytes()` | `Uint8Array` |
| `.response()` | raw `Response` (headers, streaming) |
| `.stream()` | `ReadableStream` body |
| `.toFile(path)` | writes to disk (Node/Bun/Deno), returns the path |

```js
// Inspect headers
const res = await st.transform(file).convert('webp').response()
console.log(res.headers.get('content-type')) // image/webp

// Node: straight to disk
await st.transform('./in.jpg').resize(1024).convert('avif').toFile('./out.avif')
```

## Shortcuts

For one-off operations, skip the chain:

```js
const png   = await st.convert(file, 'png')
const small = await st.resize(file, 320, 240)
```

## Error handling

```js
import { SharptownError } from '@sharptown/client'

try {
  await st.transform(file).convert('webp')
} catch (error) {
  if (error instanceof SharptownError) {
    console.error(error.status, error.message, error.body)
  }
}
```

`SharptownError` carries `status` (HTTP status when the error came from the server) and
`body` (the parsed `{ error }` payload, when present).

## Custom transport / headers

```js
import { sharptown, rest } from '@sharptown/client'

const st = sharptown('http://localhost:3001', {
  transport: rest({ field: 'image', path: '/api/v1/transform' }),
  headers: { authorization: 'Bearer …' },
})
```

## Exports

```js
import {
  sharptown,        // factory
  SharptownClient,  // the client class
  TransformBuilder, // the chainable builder
  rest,             // the REST transport factory
  SharptownError,   // error type
  SUPPORTED_FORMATS // readonly list of output formats
} from '@sharptown/client'
```
