---
title: REST API
description: The POST /api/v1/transform endpoint — parameters, requests, and responses.
group: Transports
order: 1
---

# REST API

The REST transport is the default and the simplest: upload an image as `multipart/form-data`,
pass operations as query parameters, get the transformed binary back.

It is served by `@sharptown/server-rest` (Fastify + the `@sharptown/fastify-plugin` plugin +
a static UI) on port **3001** by default.

## Transform an image

```
POST /api/v1/transform
Content-Type: multipart/form-data
```

- **File field:** `image` (the upload).
- **Operations:** query-string parameters (see below).
- **Success:** the binary image, with the matching `Content-Type` header.
- **Error:** JSON `{ "error": "..." }` with status `400` (bad parameters) or `415`
  (unsupported / corrupt image).

## Query parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `width` | number | Resize width. |
| `height` | number | Resize height. |
| `rotate` | number | Rotate (degrees). |
| `flip` | boolean | Flip horizontally. |
| `blur` | number | Blur radius / sigma. |
| `r`, `g`, `b` | number | RGB tint (0–255 each). |
| `grayscale` / `greyscale` | boolean | Convert to grayscale. |
| `removeAlpha` | boolean | Remove the alpha channel. |
| `ensureAlpha` | boolean | Ensure an alpha channel. |
| `convertTo` | string | Output format: `webp`, `png`, `jpg`, `jpeg`, `avif`, `gif`, `heif`. |

Full details and validation rules live in the [Operations reference](/docs/operations).

## Examples

### curl

```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" \
  --output out.webp
```

### fetch (browser)

```js
const form = new FormData()
form.append('image', fileInput.files[0])

const params = new URLSearchParams({ width: '800', convertTo: 'webp' })
const res = await fetch(`http://localhost:3001/api/v1/transform?${params}`, {
  method: 'POST',
  body: form,
})

if (!res.ok) throw new Error((await res.json()).error)
const blob = await res.blob()
document.querySelector('img').src = URL.createObjectURL(blob)
```

## Responses

| Status | Body | When |
| ------ | ---- | ---- |
| `200` | binary image | Success — see the `Content-Type` header. |
| `400` | `{ "error": "No file uploaded" }` | No `image` field in the request. |
| `400` | `{ "error": "Invalid <field> value" }` | A parameter is out of range / non-numeric. |
| `400` | `{ "error": "Invalid convert format target" }` | `convertTo` is not supported. |
| `415` | `{ "error": "Unsupported or corrupt image" }` | The upload is not a decodable image. |

## CORS & static UI

The REST host enables permissive CORS (`origin: '*'`) and serves a small static UI at `/`,
which makes it convenient to call directly from a browser app or the
[JS client](/docs/js-client).

## Use it as a plugin

The transform route ships as a standalone Fastify plugin you can register into your own
app — see [Fastify plugin](/docs/fastify-plugin).
