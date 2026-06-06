# @sharptown/react

React bindings for [Sharptown](https://github.com/e1berd/sharptown). Ships a single-`<img>`
`<ImageDelivery>` component that turns transform props into a signed image-proxy URL using
[`@sharptown/client`](https://www.npmjs.com/package/@sharptown/client).

```sh
npm install @sharptown/react @sharptown/client react
```

## Provide a client

Wrap your tree once. The client needs a `proxySecret` to sign delivery URLs — only configure
it where the secret stays server-side (SSR/SSG).

```tsx
import { sharptown } from '@sharptown/client'
import { SharptownProvider } from '@sharptown/react'

const client = sharptown('https://img.example.com', { proxySecret: process.env.SHARPTOWN_PROXY_KEY })

export function App() {
  return (
    <SharptownProvider client={client}>
      <Gallery />
    </SharptownProvider>
  )
}
```

## Render images

```tsx
import { ImageDelivery } from '@sharptown/react'

export function Gallery() {
  return (
    <ImageDelivery
      src="https://example.com/photo.png"
      width={100}
      height={100}
      blur={1}
      aspectRatio={16 / 9}
      alt="A blurred photo"
      onLoad={(event) => console.log('loaded', event.currentTarget.naturalWidth)}
      onError={() => console.warn('failed')}
    />
  )
}
```

The component renders exactly one `<img>` root. Any non-transform prop (`alt`, `className`,
`loading`, `decoding`, `sizes`, `srcSet`, `onLoad`, `onError`, …) is forwarded to it.
Transform props are every key of `Operations` from `@sharptown/client`.

## API

- `SharptownProvider` — context provider; pass your client via the `client` prop.
- `useSharptownClient()` — read the provided client (throws if no provider above).
- `ImageDelivery` — the component above.

## License

MIT
