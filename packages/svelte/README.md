# @sharptown/svelte

Svelte 5 bindings for [Sharptown](https://github.com/e1berd/sharptown). Ships a single-`<img>`
`<ImageDelivery>` component that turns transform props into a signed image-proxy URL using
[`@sharptown/client`](https://www.npmjs.com/package/@sharptown/client).

```sh
npm install @sharptown/svelte @sharptown/client svelte
```

## Provide a client

Set a client once in a parent component. The client needs a `proxySecret` to sign delivery
URLs — only configure it where the secret stays server-side (SSR/SSG).

```svelte
<script>
  import { sharptown } from '@sharptown/client'
  import { setSharptownClient } from '@sharptown/svelte'

  setSharptownClient(sharptown('https://img.example.com', { proxySecret: SHARPTOWN_PROXY_KEY }))
</script>

<slot />
```

## Render images

```svelte
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
  onload={() => console.log('loaded')}
  onerror={() => console.warn('failed')}
/>
```

The component renders exactly one `<img>` root. Any non-transform attribute or event
(`alt`, `class`, `loading`, `decoding`, `sizes`, `srcset`, `onload`, `onerror`, …) is
forwarded to it. Transform props are every key of `Operations` from `@sharptown/client`.

## API

- `setSharptownClient(client)` — set a client for descendants (uses Svelte context).
- `getSharptownClient()` — read the set client (throws if none).
- `ImageDelivery` — the component above.

## License

MIT
