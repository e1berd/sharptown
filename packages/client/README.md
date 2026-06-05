# @sharptown/client

Expressive, **isomorphic** JavaScript client for the [Sharptown](../../README.md)
image transformation API. Runs in the **browser, Node, Bun and Deno** — zero
dependencies, built on `fetch` + `FormData`.

```bash
pnpm add @sharptown/client
```

## Quick start

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001') // a string or a URL instance

const webp = await st
  .transform(file)        // File / Blob / ArrayBuffer / Uint8Array / URL / path
  .resize(800, 600)
  .blur(3)
  .grayscale()
  .convert('webp')        // <- awaiting the chain returns a Blob

// download it in the browser
const url = URL.createObjectURL(webp)
```

The builder is **chainable** and **thenable**: `await`-ing it runs the request and
resolves to a `Blob`. Need another shape? Use an explicit terminal.

## Operations

| Method | Description |
| ------ | ----------- |
| `.resize(w, h)` / `.resize({ width, height })` / `.width(w)` / `.height(h)` | Resize |
| `.rotate(deg)` | Rotate by degrees |
| `.flip()` | Flip horizontally |
| `.blur(sigma)` | Blur |
| `.tint(r, g, b)` / `.tint({ r, g, b })` | RGB tint (0–255) |
| `.grayscale()` / `.greyscale()` | Desaturate |
| `.removeAlpha()` / `.ensureAlpha()` | Alpha control |
| `.convert(format)` / `.toFormat(format)` | `webp` `png` `jpg` `jpeg` `avif` `gif` `heif` |
| `.abortWith(signal)` | Attach an `AbortSignal` |

## Terminals

| Terminal | Resolves to |
| -------- | ----------- |
| `await chain` / `.blob()` | `Blob` |
| `.arrayBuffer()` | `ArrayBuffer` |
| `.bytes()` | `Uint8Array` |
| `.stream()` | `ReadableStream` (response body) |
| `.response()` | raw `Response` |
| `.toFile(path)` | writes to disk (Node/Bun/Deno), returns the path |

## Runtime examples

**Node / Bun / Deno** — read from a path, write to disk:

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')
await st.transform('./input.jpg').resize(1024).convert('avif').toFile('./out.avif')
```

**Browser** — from an `<input type="file">`:

```js
input.addEventListener('change', async () => {
  const blob = await st.transform(input.files[0]).resize(400).convert('webp')
  img.src = URL.createObjectURL(blob)
})
```

## Configuration

```js
sharptown('http://localhost:3001', {
  headers: { Authorization: 'Bearer …' }, // default headers per request
  fetch: customFetch,                      // inject fetch (Node < 18, proxies, tests)
  transport: rest({ field: 'image' }),     // pluggable transport (REST today)
})
```

The scheme is optional — a bare host like `localhost:3001` defaults to the secure `https://`;
pass `http://` explicitly for a plain connection (such as a local dev server).

## Errors

Failed requests and invalid operations throw a `SharptownError` with `.status`
and `.body`:

```js
import { SharptownError } from '@sharptown/client'

try {
  await st.transform(file).convert('webp')
} catch (err) {
  if (err instanceof SharptownError) console.error(err.status, err.message)
}
```

## License

MIT
