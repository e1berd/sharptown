# @sharptown/server-jsonrpc

A [JSON-RPC 2.0](https://www.jsonrpc.org/specification) server **over WebSocket** for
Sharptown image transforms. Built on Fastify + `@fastify/websocket`, the imaging is done
by [`@sharptown/core`](../core).

## Run

```bash
pnpm jsonrpc            # from the repo root (dev/watch)
# or
pnpm --filter @sharptown/server-jsonrpc prod
```

Listens on `ws://{SHARPTOWN_JSONRPC_HOST:-0.0.0.0}:{SHARPTOWN_JSONRPC_PORT:-3002}/rpc`.

## Protocol

Connect a WebSocket to `/rpc` and send JSON-RPC 2.0 frames.

### `image.transform`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `params.image` | string | source image, **base64-encoded** |
| `params.options` | object | operations (same names as `@sharptown/core`: `width`, `height`, `rotate`, `flip`, `blur`, `r`/`g`/`b`, `grayscale`, `removeAlpha`, `ensureAlpha`, `convertTo`) |

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "image.transform",
  "params": { "image": "<base64>", "options": { "width": 200, "convertTo": "webp" } }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { "image": "<base64>", "format": "webp", "contentType": "image/webp" }
}
```

### Errors

Standard JSON-RPC codes: `-32700` parse, `-32600` invalid request, `-32601` method not
found, `-32602` invalid params (also used for invalid operations), `-32603` internal,
`-32000` unsupported/corrupt image. Notifications (frames without `id`) get no response.

## Example client (Node)

```js
import WebSocket from 'ws'
import { readFile, writeFile } from 'node:fs/promises'

const ws = new WebSocket('ws://localhost:3002/rpc')
ws.on('open', async () => {
  const image = (await readFile('input.png')).toString('base64')
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'image.transform',
    params: { image, options: { width: 200, convertTo: 'webp' } },
  }))
})
ws.on('message', async (raw) => {
  const { result, error } = JSON.parse(raw)
  if (error) throw new Error(error.message)
  await writeFile('out.webp', Buffer.from(result.image, 'base64'))
  ws.close()
})
```

## License

MIT
