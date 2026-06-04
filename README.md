# Sharptown

Sharptown is an image transformation service and package set built on
[Sharp](https://sharp.pixelplumbing.com). It provides resize, crop, rotation, filtering,
alpha-channel operations, and format conversion through REST, gRPC, JSON-RPC, and a
JavaScript client.

The project is a pnpm monorepo. Shared image-processing logic lives in
`@sharptown/core`; server packages and clients use that package as the common engine.

## Packages

| Package | Path | Purpose |
| ------- | ---- | ------- |
| `@sharptown/core` | [`packages/core`](packages/core) | Framework-agnostic Sharp transformation engine |
| `@sharptown/fastify-plugin` | [`packages/fastify`](packages/fastify) | Fastify plugin exposing `POST /transform` |
| `@sharptown/client` | [`packages/client`](packages/client) | Isomorphic JavaScript client for browsers, Node.js, Bun, and Deno |
| `@sharptown/server-rest` | [`packages/server-rest`](packages/server-rest) | Fastify REST server with the plugin and static UI |
| `@sharptown/server-grpc` | [`packages/server-grpc`](packages/server-grpc) | gRPC server with streaming image processing |
| `@sharptown/server-jsonrpc` | [`packages/server-jsonrpc`](packages/server-jsonrpc) | JSON-RPC 2.0 server over WebSocket |
| `@sharptown/example-vue` | [`examples/vue`](examples/vue) | Vue 3 and Vite example using the JavaScript client |

## Features

- Conversion to Sharp-supported output formats, including WebP, PNG, JPEG, GIF, AVIF,
  and HEIF.
- Resize operations: `width`, `height`, `dpr`, `aspectRatio`, `fit`, `background`.
- Crop operations: `crop`, `cropOffset`, `smartCrop`.
- Orientation operations: `autoOrient`, `rotate`, `flip`.
- Tone and color operations: `brightness`, `contrast`, `saturation`, `exposure`, `hue`,
  `gamma`, `colorize`, RGB `tint`, `grayscale`.
- Filters and effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
- Output controls: `convertTo`, `quality`, `progressive`, `stripMetadata`.
- Alpha-channel controls: `removeAlpha`, `ensureAlpha`.
- Shared operation model across REST, gRPC, JSON-RPC, and the JavaScript client.
- Local and Docker Compose deployment options.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

By default, the REST server listens on `http://localhost:3001`.

Common commands:

```bash
pnpm dev         # REST server in watch mode, port 3001
pnpm grpc        # gRPC server, port 50051
pnpm jsonrpc     # JSON-RPC server over WebSocket, port 3002
pnpm docs        # local documentation site
pnpm build       # build all packages
```

REST, gRPC, and JSON-RPC are independent server packages. Each server is started
separately and uses the shared `@sharptown/core` package.

## REST API

The REST server exposes:

```http
POST /api/v1/transform
```

Send the image as the multipart field `image`. Send transformation options as query
parameters.

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `width` | number | Output width |
| `height` | number | Output height |
| `rotate` | number | Rotation angle in degrees |
| `flip` | boolean | Horizontal flip |
| `blur` | number | Blur radius |
| `r`, `g`, `b` | number | RGB tint |
| `grayscale`, `greyscale` | boolean | Convert to grayscale |
| `removeAlpha` | boolean | Remove alpha channel |
| `ensureAlpha` | boolean | Add alpha channel |
| `convertTo` | string | Output format: `webp`, `png`, `jpg`, `gif`, `avif`, and others |

Example request:

```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" \
  -o out.webp
```

A successful response contains the binary image with the correct `content-type`. Errors
are returned as JSON:

```json
{
  "error": "Unsupported format"
}
```

Detailed REST and operation documentation:

- [`docs/src/content/docs/en/rest-api.md`](docs/src/content/docs/en/rest-api.md)
- [`docs/src/content/docs/en/operations.md`](docs/src/content/docs/en/operations.md)

## gRPC API

[`@sharptown/server-grpc`](packages/server-grpc) provides an `ImageProcessor` service
with bidirectional streaming. Input files are sent in chunks, and transformed output is
returned in chunks. The server does not need to buffer the complete image in memory.

The service contract is defined in
[`packages/server-grpc/proto/sharptown.proto`](packages/server-grpc/proto/sharptown.proto):

```proto
service ImageProcessor {
  rpc Transform(stream TransformRequest) returns (stream TransformResponse);
}
```

Run the server:

```bash
pnpm grpc
```

By default, the gRPC server listens on `0.0.0.0:50051`. Configure the host and port with
`SHARPTOWN_GRPC_HOST` and `SHARPTOWN_GRPC_PORT`.

Node.js client example:

```js
import * as grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { createReadStream, createWriteStream } from 'node:fs'

const def = protoLoader.loadSync('packages/server-grpc/proto/sharptown.proto', {
  keepCase: false,
  oneofs: true,
  defaults: true,
})
const { sharptown } = grpc.loadPackageDefinition(def)
const client = new sharptown.v1.ImageProcessor(
  'localhost:50051',
  grpc.credentials.createInsecure(),
)

const out = createWriteStream('map.webp')
const call = client.Transform()

call.on('data', ({ chunk }) => out.write(chunk))
call.on('end', () => out.end())

call.write({ options: { width: 4096, convertTo: 'webp' } })

const src = createReadStream('map-3gb.png')
src.on('data', (chunk) => call.write({ chunk }))
src.on('end', () => call.end())
```

Consider output format limits for large images. WebP is limited to `16383x16383` pixels.
JPEG is limited to `65535x65535` pixels. If an image exceeds the WebP limit, use JPEG or
resize the image in the same request.

## JSON-RPC over WebSocket

[`@sharptown/server-jsonrpc`](packages/server-jsonrpc) exposes the `image.transform`
method through JSON-RPC 2.0 over WebSocket:

```text
ws://localhost:3002/rpc
```

Run the server:

```bash
pnpm jsonrpc
```

Send the file as a base64 string in `params.image`. Send transformation options in
`params.options`.

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

See [`packages/server-jsonrpc`](packages/server-jsonrpc) for package-level details.

## JavaScript Client

[`@sharptown/client`](packages/client) is an isomorphic JavaScript client with no runtime
dependencies. It works in browsers, Node.js, Bun, and Deno through `fetch` and
`FormData`.

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')

const webp = await st
  .transform(file)
  .resize(800, 600)
  .blur(3)
  .grayscale()
  .convert('webp')
```

The builder is thenable: awaiting the chain executes the request and returns a `Blob`.
Other terminal methods include `.arrayBuffer()`, `.bytes()`, `.stream()`, `.response()`,
and `.toFile(path)`.

## Vue Example

The Vue 3 and Vite demo is available in [`examples/vue`](examples/vue). It provides a
small UI for selecting an image, configuring operations, and previewing the result.

Start the REST server first, then run:

```bash
pnpm --filter @sharptown/example-vue dev
```

## Fastify Plugin

REST transformation is also available as a standalone Fastify plugin:
[`@sharptown/fastify-plugin`](packages/fastify).

```js
import Fastify from 'fastify'
import sharptown from '@sharptown/fastify-plugin'

const app = Fastify()

await app.register(sharptown, { prefix: '/api/v1' })
await app.listen({ port: 3001 })
```

The plugin registers `POST /api/v1/transform` and uses the shared
[`@sharptown/core`](packages/core) engine. New adapters for Hono, Elysia, Express, and
other frameworks can follow the same contract:
[`packages/core#writing-a-new-adapter`](packages/core#writing-a-new-adapter).

## Docker

Each server package has its own Dockerfile. Build images from the repository root:

```bash
docker build -f packages/server-rest/Dockerfile -t sharptown-rest .
docker run -p 3001:3001 -d sharptown-rest
```

`docker-compose.yml` defines three services:

| Service | Port | Purpose |
| ------- | ---- | ------- |
| `rest` | `3001` | REST API |
| `grpc` | `50051` | gRPC API |
| `jsonrpc` | `3002` | JSON-RPC over WebSocket |

```bash
cp .env.example .env          # optional
docker compose up --build rest
docker compose up --build
```

## Documentation

Documentation is available in [`docs`](docs). Run it locally with:

```bash
pnpm docs
```

Useful documentation pages:

- [`docs/src/content/docs/en/getting-started.md`](docs/src/content/docs/en/getting-started.md)
- [`docs/src/content/docs/en/rest-api.md`](docs/src/content/docs/en/rest-api.md)
- [`docs/src/content/docs/en/grpc-api.md`](docs/src/content/docs/en/grpc-api.md)
- [`docs/src/content/docs/en/jsonrpc-api.md`](docs/src/content/docs/en/jsonrpc-api.md)
- [`docs/src/content/docs/en/js-client.md`](docs/src/content/docs/en/js-client.md)
- [`docs/src/content/docs/en/deployment.md`](docs/src/content/docs/en/deployment.md)

## Development

```bash
pnpm install
pnpm build
```

Before opening a pull request, run the build and any checks relevant to the changed
packages.

Suggested workflow:

1. Create a branch.
2. Make the changes.
3. Run relevant checks.
4. Open a pull request.

## Roadmap

- Astro and Starlight documentation site.
- OpenAPI and Swagger support for the REST API.
- Additional filters and transformation operations.
- Batch image processing.
