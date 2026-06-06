---
title: Frontend Components
description: Single-<img> ImageDelivery components for Vue, React, Svelte and Astro.
group: Guide
order: 1.5
---

# Frontend Components

Sharptown ships thin framework bindings on top of [`@sharptown/client`](/docs/js-client) so you
can drop transformed images straight into your UI:

| Package | Framework |
| ------- | --------- |
| `@sharptown/vue` | Vue 3 |
| `@sharptown/react` | React 18+ |
| `@sharptown/svelte` | Svelte 5 |
| `@sharptown/astro` | Astro 4+ |

Each one exposes the same idea: a single-`<img>` **`ImageDelivery`** component plus a way to
share one client through the component tree. The component renders exactly one `<img>` root,
so every native attribute and event — `alt`, `class`, `loading`, `decoding`, `sizes`,
`srcset`, `load`, `error` — is forwarded to it untouched. Transform props (`width`, `height`,
`blur`, `aspectRatio`, and any other key of [`Operations`](/docs/operations)) are turned into a
**signed** [image-proxy URL](/docs/image-proxy) via `client.signedUrl(...)`.

## Security: where to put the secret

Signing requires the server's `SHARPTOWN_PROXY_KEY`. Build the client with a `proxySecret`
**only where that secret stays server-side** — SSR/SSG render, an Astro page, a Nuxt/Next
server component. In a pure client-side SPA the secret would ship in the bundle; treat that as
your own trade-off.

## Vue

Provide a client once in a parent, then render `ImageDelivery` anywhere below it.

```vue
<!-- Parent -->
<script setup lang="ts">
import { sharptown } from '@sharptown/client'
import { provideSharptownClient } from '@sharptown/vue'

provideSharptownClient(sharptown('https://img.example.com', { proxySecret: SHARPTOWN_PROXY_KEY }))
</script>
```

```vue
<!-- Child -->
<script setup lang="ts">
import { ImageDelivery } from '@sharptown/vue'
</script>

<template>
  <ImageDelivery
    src="https://example.com/photo.png"
    :width="100"
    :height="100"
    :blur="1"
    :aspect-ratio="16 / 9"
    alt="A blurred photo"
    @load="onLoad"
    @error="onError"
  />
</template>
```

- `provideSharptownClient(client)` — provide a client to descendants (call in a parent `setup`).
- `useSharptownClient()` — read the provided client (throws if none).

## React

```tsx
import { sharptown } from '@sharptown/client'
import { SharptownProvider, ImageDelivery } from '@sharptown/react'

const client = sharptown('https://img.example.com', { proxySecret: process.env.SHARPTOWN_PROXY_KEY })

export function App() {
  return (
    <SharptownProvider client={client}>
      <ImageDelivery
        src="https://example.com/photo.png"
        width={100}
        height={100}
        blur={1}
        aspectRatio={16 / 9}
        alt="A blurred photo"
        onLoad={() => {}}
        onError={() => {}}
      />
    </SharptownProvider>
  )
}
```

- `SharptownProvider` — context provider; pass the client via the `client` prop.
- `useSharptownClient()` — read the provided client.

## Svelte

```svelte
<!-- Parent -->
<script>
  import { sharptown } from '@sharptown/client'
  import { setSharptownClient } from '@sharptown/svelte'

  setSharptownClient(sharptown('https://img.example.com', { proxySecret: SHARPTOWN_PROXY_KEY }))
</script>

<slot />
```

```svelte
<!-- Child -->
<script>
  import { ImageDelivery } from '@sharptown/svelte'
</script>

<ImageDelivery
  src="https://example.com/photo.png"
  width={100}
  height={100}
  blur={1}
  aspectRatio={16 / 9}
  alt="A blurred photo"
  onload={() => {}}
  onerror={() => {}}
/>
```

- `setSharptownClient(client)` / `getSharptownClient()` — share the client via Svelte context.

## Astro

Astro renders on the server, so the URL is signed during render and the secret never reaches
the browser. Register the client once, then import the component by path.

```ts
// src/sharptown.ts
import { sharptown } from '@sharptown/client'
import { setSharptownClient } from '@sharptown/astro'

setSharptownClient(sharptown('https://img.example.com', { proxySecret: import.meta.env.SHARPTOWN_PROXY_KEY }))
```

```astro
---
import '../sharptown.ts'
import ImageDelivery from '@sharptown/astro/ImageDelivery.astro'
---

<ImageDelivery
  src="https://example.com/photo.png"
  width={100}
  height={100}
  blur={1}
  aspectRatio={16 / 9}
  alt="A blurred photo"
/>
```

- `setSharptownClient(client)` / `getSharptownClient()` — register/read the client (module singleton).
