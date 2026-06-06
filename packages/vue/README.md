# @sharptown/vue

Vue 3 bindings for [Sharptown](https://github.com/e1berd/sharptown). Ships a single-`<img>`
`<ImageDelivery>` component that turns transform props into a signed image-proxy URL using
[`@sharptown/client`](https://www.npmjs.com/package/@sharptown/client).

```sh
npm install @sharptown/vue @sharptown/client vue
```

## Provide a client

Create a client once and provide it to the component tree. The client needs a `proxySecret`
to sign delivery URLs — only configure it where the secret stays server-side (SSR/SSG).

```vue
<script setup lang="ts">
import { sharptown } from '@sharptown/client'
import { provideSharptownClient } from '@sharptown/vue'

provideSharptownClient(sharptown('https://img.example.com', { proxySecret: import.meta.env.SHARPTOWN_PROXY_KEY }))
</script>
```

## Render images

```vue
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

The component renders exactly one `<img>` root. Any non-transform attribute or listener
(`alt`, `class`, `loading`, `decoding`, `sizes`, `srcset`, `@load`, `@error`, …) is forwarded
to it. Transform props are every key of `Operations` from `@sharptown/client` — `width`,
`height`, `dpr`, `aspectRatio`, `fit`, `blur`, `quality`, `convertTo`, and so on.

## API

- `provideSharptownClient(client)` — provide a client to descendants. Call in a parent `setup`.
- `useSharptownClient()` — read the provided client (throws if none).
- `ImageDelivery` — the component above.

## License

MIT
