---
title: JSON-RPC API
description: JSON-RPC 2.0 over WebSocket with base64 payloads.
group: Transports
order: 3
---

# JSON-RPC API

`@sharptown/server-jsonrpc` exposes the transform as **JSON-RPC 2.0 over a WebSocket** at
`/rpc`. It is handy for apps that already hold a persistent socket and want batching or
notifications.

It runs on port **3002** by default (`SHARPTOWN_JSONRPC_PORT` / `SHARPTOWN_JSONRPC_HOST`).

```bash
pnpm jsonrpc     # ws://localhost:3002/rpc
```

## The method: `image.transform`

Images travel as **base64** strings in and out.

**Params**

```ts
{
  image: string,                 // base64-encoded source image (required)
  options?: TransformOptions     // same operations as everywhere else
}
```

**Result**

```ts
{
  image: string,        // base64-encoded transformed image
  format: string,       // e.g. "webp"
  contentType: string   // e.g. "image/webp"
}
```

## Example exchange

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "image.transform",
  "params": {
    "image": "<base64>",
    "options": { "width": 200, "convertTo": "webp" }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "image": "<base64>",
    "format": "webp",
    "contentType": "image/webp"
  }
}
```

## Browser client example

```js
const socket = new WebSocket('ws://localhost:3002/rpc')

function toBase64(arrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

socket.addEventListener('open', async () => {
  const buf = await file.arrayBuffer()
  socket.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'image.transform',
    params: { image: toBase64(buf), options: { width: 200, convertTo: 'webp' } },
  }))
})

socket.addEventListener('message', (event) => {
  const { result, error } = JSON.parse(event.data)
  if (error) throw new Error(error.message)
  const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: result.contentType })
  document.querySelector('img').src = URL.createObjectURL(blob)
})
```

## Spec coverage

The server implements the JSON-RPC 2.0 essentials:

- **Single requests** with an `id`.
- **Batches** — an array of requests, answered with an array of responses.
- **Notifications** — requests without an `id` produce no response.

## Error codes

| Code | Meaning | When |
| ---- | ------- | ---- |
| `-32700` | Parse error | Body is not valid JSON. |
| `-32600` | Invalid Request | Not a well-formed JSON-RPC request. |
| `-32601` | Method not found | Unknown method name. |
| `-32602` | Invalid params | Missing `image`, or an invalid operation value. |
| `-32000` | Server error | Unsupported or corrupt image. |
| `-32603` | Internal error | Unexpected failure. |
