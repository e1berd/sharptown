# 🏙️ Sharptown — Fastify Image Transformer API & Plugin

A high-performance image transformation and conversion service powered by Fastify + Sharp.
Resize, rotate, blur, grayscale, modify alpha, convert formats — all on-the-fly via REST API.

Perfect for web developers optimizing image delivery 🚀


## ✨ Features
- Convert any supported format to any other (WebP, PNG, JPEG, GIF, AVIF…)
- Resize: width / height
- Rotate / Flip
- Blur
- Grayscale / Greyscale
- RGB tint filter (r, g, b)
- Alpha control: removeAlpha / ensureAlpha
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

Контракт — в [`proto/sharptown.proto`](proto/sharptown.proto):

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
npm install
cp .env.example .env
npm run grpc:dev        # dev (watch)
# или: npm run grpc     # prod
```

Порт настраивается через `SHARPTOWN_GRPC_PORT` (по умолчанию `50051`) и
`SHARPTOWN_GRPC_HOST` (по умолчанию `0.0.0.0`). REST (`index.mjs`) и gRPC (`grpc.mjs`) —
независимые процессы.

### Пример клиента (Node.js)

```js
import * as grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { createReadStream, createWriteStream } from 'node:fs'

const def = protoLoader.loadSync('proto/sharptown.proto', { keepCase: false, oneofs: true, defaults: true })
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
npm install
cp .env.example .env
npm run dev:env
```

## Docker
```bash
docker build -t sharptown .
docker run -p 3000:3000 -d sharptown
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
Sharptown can also be used as a Fastify plugin inside your server.
Example usage will be published soon.

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
