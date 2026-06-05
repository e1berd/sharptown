---
title: Signed Image Proxy
description: Transform remote images on the fly from a signed URL, with HMAC-signed requests, SSRF protection, and long-lived cache headers.
group: Transports
order: 4
---

# Signed Image Proxy

The REST server can transform a **remote** image referenced by URL instead of an uploaded
file, so the transformed image can be embedded directly in an `<img src>`. The server
downloads the source, applies the same operations as `POST /transform`, and returns the
result with long-lived cache headers — the heavy work runs once per unique URL and a CDN or
browser serves the rest.

```http
GET /api/v1/fetch?url=<source>&width=800&convertTo=webp&sig=<signature>
```

## Enabling it

The proxy is disabled until an HMAC secret is set. Configure it with the `SHARPTOWN_PROXY_*`
[environment variables](/docs/configuration):

```ini
SHARPTOWN_PROXY_KEY=a-long-random-secret
SHARPTOWN_PROXY_ALLOWED_HOSTS=*
```

With an empty `SHARPTOWN_PROXY_KEY`, `GET /api/v1/fetch` responds with `503` — there is no
unsigned (open-proxy) mode.

## Signing

Every request must carry a `sig` parameter: the base64url HMAC-SHA256 of the canonical
request, keyed with `SHARPTOWN_PROXY_KEY`. The canonical string is every parameter except
`sig` — including `url` — as decoded `key=value` pairs **sorted by key** and joined with
`&`:

```text
blur=3&convertTo=webp&url=https://example.com/a.jpg&width=800
```

Because the signature covers the source URL and all operations, the parameters cannot be
tampered with. The order parameters appear in the final URL does not matter — only the
sorted canonical form is signed.

Each client builds the signed URL for you, so you rarely sign by hand:

```js
// JavaScript
import { sharptown } from '@sharptown/client'

const st = sharptown('https://img.example.com', { proxySecret: process.env.SHARPTOWN_PROXY_KEY })
const src = await st.signedUrl('https://example.com/photo.jpg', { width: 800, convertTo: 'webp' })
```

The equivalent helper in the other clients:

| Client | Method |
| ------ | ------ |
| JavaScript | `client.signedUrl(source, operations)` |
| Go | `client.SignedURL(source, ops)` |
| PHP | `$client->signedUrl($source, $operations)` |
| Elixir | `Sharptown.signed_url(client, source, operations)` |
| Dart/Flutter | `client.signedUrl(source, operations)` |
| Rust | `client.signed_url(source, &ops)` |

## Security

The proxy is built to be a closed, well-behaved fetcher:

- **Signed only.** Requests without a valid `sig` are rejected (`401`/`403`).
- **SSRF protection.** Private, loopback, link-local and cloud-metadata addresses are
  blocked even when `SHARPTOWN_PROXY_ALLOWED_HOSTS=*`, with the hostname resolved before the
  fetch. Set the allowlist (e.g. `cdn.example.com,*.images.example.com`) to restrict sources.
- **No redirects.** A redirect would bypass the checks made on the original URL, so 3xx
  responses are refused.
- **Bounded fetch.** The upstream request is limited by `SHARPTOWN_PROXY_TIMEOUT_MS` and
  `SHARPTOWN_PROXY_MAX_BYTES`.

## Caching

Successful responses carry `Cache-Control` (`SHARPTOWN_PROXY_CACHE_CONTROL`, a one-year
immutable policy by default) and an `ETag`, and honour `If-None-Match` with `304 Not
Modified`. A transformed image is therefore computed once and reused by every cache in front
of the server. Because the cache key is the full signed URL, a transform is permanent: if
the source image at a URL changes, version the URL or lower the `max-age`.
