# 🏙️ Sharptown — Fastify Image Transformer API & Plugin

A high-performance image transformation and conversion service powered by Fastify + Sharp.
Resize, rotate, blur, grayscale, modify alpha, convert formats — all on-the-fly via REST API.

Perfect for web developers optimizing image delivery 🚀

## 📦 Monorepo

This is a [pnpm](https://pnpm.io) workspace:

| Package | Path | Description |
| ------- | ---- | ----------- |
| `@sharptown/core` | [`packages/core`](packages/core) | Framework-agnostic Sharp engine — shared by every adapter |
| `@sharptown/fastify-plugin` | [`packages/fastify`](packages/fastify) | Fastify plugin (REST `/transform`) on top of core |
| `@sharptown/client` | [`packages/client`](packages/client) | Expressive isomorphic JS client (browser / Node / Bun / Deno) |
| `@sharptown/server-rest` | [`packages/server-rest`](packages/server-rest) | REST host (Fastify + plugin + static UI) |
| `@sharptown/server-grpc` | [`packages/server-grpc`](packages/server-grpc) | gRPC streaming host |
| `@sharptown/server-jsonrpc` | [`packages/server-jsonrpc`](packages/server-jsonrpc) | JSON-RPC 2.0 over WebSocket host |
| `@sharptown/example-vue` | [`examples/vue`](examples/vue) | Vue 3 + Vite demo using the client |

```bash
pnpm install     # install all workspaces
pnpm dev         # REST server in watch mode (port 3001)
pnpm grpc        # gRPC server (port 50051)
pnpm jsonrpc     # JSON-RPC/WebSocket server (port 3002)
pnpm build       # emit type declarations for all packages
```

The three transports are **independent server packages**, all sharing `@sharptown/core`.


## ✨ Features
- Convert any supported format to any other (WebP, PNG, JPEG, GIF, AVIF, HEIF)
- Resize: `width` / `height` / `dpr` / `aspectRatio`, with `fit` modes and `background`
- Crop: `crop` (`x,y,w,h` or `WxH`+`cropOffset`) and attention-based `smartCrop`
- Orientation: `autoOrient` (EXIF), `rotate`, `flip`
- Tone & color: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`, `colorize`, RGB `tint`, `grayscale`
- Filters & effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`
- Output control: `quality`, `progressive`, `stripMetadata`
- Alpha control: `removeAlpha` / `ensureAlpha`
- Same operations across REST, gRPC and JSON-RPC
- Docker-ready
- Fully configurable via `.env`

## 📡 API Endpoints
### 🔄 Transform Image — POST /api/v1/transform

Upload an image and apply any transformations through query parameters.

| Name                      | Type    | Description                                              |
| ------------------------- | ------- | -------------------------------------------------------- |
| `width`                   | number  | Resize width                                             |
| `height`                  | number  | Resize height                                            |
| `rotate`                  | number  | Rotate (°)                                               |
| `flip`                    | boolean | Flip horizontally                                        |
| `blur`                    | number  | Blur radius                                              |
| `r`, `g`, `b`             | number  | RGB tint                                                 |
| `grayscale` / `greyscale` | boolean | Convert to grayscale                                     |
| `removeAlpha`             | boolean | Remove alpha channel                                     |
| `ensureAlpha`             | boolean | Ensure alpha channel                                     |
| `convertTo`               | string  | Output format: `webp`, `png`, `jpg`, `gif`, `avif`, etc. |


## Example Request
```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3000/api/v1/transform?width=500&blur=3&convertTo=webp"
```

## 🛰️ gRPC API (streaming, для файлов любого размера)

Помимо REST доступен gRPC-сервис `ImageProcessor` с **двунаправленным стримингом**.
Он спроектирован под файлы произвольного размера (например, карта PNG ~3 ГБ → WebP/JPEG):
данные передаются чанками и **никогда не собираются целиком в память** — входной поток
пайпится прямо в Sharp, а результат отдаётся обратно потоком чанков. Backpressure
соблюдается в обе стороны.

Контракт — в [`packages/server-grpc/proto/sharptown.proto`](packages/server-grpc/proto/sharptown.proto):

```proto
service ImageProcessor {
  // Первое сообщение — options, последующие — chunk'и байт.
  rpc Transform(stream TransformRequest) returns (stream TransformResponse);
}
```

Опции `TransformOptions` паритетны REST `/api/v1/transform` (`width`, `height`,
`rotate`, `flip`, `blur`, `tint_r/g/b`, `grayscale`, `remove_alpha`, `ensure_alpha`,
`convert_to`).

### Запуск

```bash
pnpm install
cp .env.example .env
pnpm grpc        # dev (watch)
```

Порт настраивается через `SHARPTOWN_GRPC_PORT` (по умолчанию `50051`) и
`SHARPTOWN_GRPC_HOST` (по умолчанию `0.0.0.0`). REST, gRPC и JSON-RPC — это **три
независимых пакета-сервера** (`@sharptown/server-rest`, `@sharptown/server-grpc`,
`@sharptown/server-jsonrpc`), каждый запускается отдельно.

### Пример клиента (Node.js)

```js
import * as grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { createReadStream, createWriteStream } from 'node:fs'

const def = protoLoader.loadSync('packages/server-grpc/proto/sharptown.proto', { keepCase: false, oneofs: true, defaults: true })
const { sharptown } = grpc.loadPackageDefinition(def)
const client = new sharptown.v1.ImageProcessor('localhost:50051', grpc.credentials.createInsecure())

const call = client.Transform()
call.on('data', ({ chunk }) => out.write(chunk))
const out = createWriteStream('map.webp')
call.on('end', () => out.end())

// 1) options, 2) поток байт исходника
call.write({ options: { width: 4096, convertTo: 'webp' } })
const src = createReadStream('map-3gb.png')
src.on('data', (chunk) => call.write({ chunk }))
src.on('end', () => call.end())
```

> **Заметки о больших файлах.** Память ограничена за счёт стриминга + `sequentialRead`.
> Учтите лимиты форматов вывода: WebP — до 16383×16383 px, JPEG — до 65535×65535 px.
> Если по пикселям карта превышает лимит WebP, выбирайте JPEG или ресайз в том же запросе.
> Для гигабайтных карт предпочтительны `resize`/`convert`/`flip`; произвольный `rotate`
> может потребовать больше памяти.

## 🚀 Getting Started
Local Development
```bash
git clone https://github.com/eckeriaue/sharptown.git
cd sharptown
pnpm install
cp .env.example .env
pnpm dev
```

## 🧑‍💻 JS Client — `@sharptown/client`

An expressive, isomorphic client (browser / Node / Bun / Deno). Full docs in
[`packages/client`](packages/client).

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

## 🎛️ Vue Example
A full Vue 3 + Vite demo lives in [`examples/vue`](examples/vue) — pick an image, chain
operations, and see the result live. With the server running:
```bash
pnpm --filter @sharptown/example-vue dev
```

## Docker
Each server host has its own Dockerfile, built from the repo root context:
```bash
docker build -f packages/server-rest/Dockerfile -t sharptown-rest .
docker run -p 3001:3001 -d sharptown-rest
```

### docker-compose
`docker-compose.yml` defines three services — `rest` (3001), `grpc` (50051), `jsonrpc` (3002):
```bash
cp .env.example .env   # optional; compose works without it
docker compose up --build rest        # REST only
docker compose up --build             # all three
```

## 🔁 API Response

On success → binary image is returned
On error → JSON

```JSON
{
  "error": "Unsupported format"
}
```

## 🔌 Fastify Plugin Usage
The REST transform is shipped as a standalone Fastify plugin, [`@sharptown/fastify-plugin`](packages/fastify),
on top of the framework-agnostic [`@sharptown/core`](packages/core) engine:

```js
import Fastify from 'fastify'
import sharptown from '@sharptown/fastify-plugin'

const app = Fastify()
await app.register(sharptown, { prefix: '/api/v1' })
await app.listen({ port: 3001 })
```

Because all imaging lives in `@sharptown/core`, adapters for **Hono, Elysia, Express** and
others are thin — see [the core adapter contract](packages/core#writing-a-new-adapter).

## 🛰️ JSON-RPC over WebSocket
[`@sharptown/server-jsonrpc`](packages/server-jsonrpc) exposes the transform as JSON-RPC 2.0
over a WebSocket at `/rpc` (method `image.transform`, base64 payloads). Run with `pnpm jsonrpc`.

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch:
```bash
git checkout -b feature/amazing-feature
```
3. Commit your changes:
```bash
git commit -m "feat: add amazing feature"
```
4. Push to the branch:
```bash
git push origin feature/amazing-feature
```
5. Create a pull request


## 🧩 Roadmap
- Astro + Starlight documentation website
- OpenAPI / Swagger support
- Extra filters: sharpen, contrast, saturation
- Batch image processing

If you'd like, I can also:
- Publish a Fastify plugin to npm
- Build Swagger docs automatically
- Anything you'd like to adjust — just tell me!
