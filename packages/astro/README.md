# @sharptown/astro

Astro bindings for [Sharptown](https://github.com/e1berd/sharptown). Ships a single-`<img>`
`<ImageDelivery>` component that turns transform props into a signed image-proxy URL using
[`@sharptown/client`](https://www.npmjs.com/package/@sharptown/client). The URL is signed on
the server during render, so the proxy secret never reaches the browser.

```sh
npm install @sharptown/astro @sharptown/client astro
```

## Register a client

Astro components render top-down on the server, so the client is registered once via a
module-level singleton. Create a shared module and import it from your layout:

```ts
// src/sharptown.ts
import { sharptown } from '@sharptown/client'
import { setSharptownClient } from '@sharptown/astro'

setSharptownClient(sharptown('https://img.example.com', { proxySecret: import.meta.env.SHARPTOWN_PROXY_KEY }))
```

```astro
---
// src/layouts/Base.astro
import '../sharptown.ts'
---
<slot />
```

## Render images

Astro components are imported by path:

```astro
---
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

The component renders exactly one `<img>` root. Any non-transform attribute (`alt`, `class`,
`loading`, `decoding`, `sizes`, `srcset`, …) is forwarded to it. Transform props are every key
of `Operations` from `@sharptown/client`. Because the markup is static server-rendered HTML,
DOM event handlers are plain attributes (e.g. `onload="…"`).

## API

- `setSharptownClient(client)` — register the client (call once at startup).
- `getSharptownClient()` — read the registered client (throws if none).
- `ImageDelivery.astro` — the component above, imported via `@sharptown/astro/ImageDelivery.astro`.

## License

MIT
