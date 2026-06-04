# Sharptown

Sharptown: сервис и набор пакетов для преобразования изображений на базе
[Sharp](https://sharp.pixelplumbing.com). Он умеет менять размер, кадрировать,
поворачивать, применять фильтры, управлять альфа-каналом и конвертировать изображения
между форматами через REST, gRPC, JSON-RPC или JavaScript-клиент.

Проект оформлен как pnpm-монорепозиторий. Общая логика обработки живет в
`@sharptown/core`, а серверные пакеты и клиенты используют ее как единый движок.

## Пакеты

| Пакет | Путь | Назначение |
| ----- | ---- | ---------- |
| `@sharptown/core` | [`packages/core`](packages/core) | Независимый от фреймворков движок преобразований поверх Sharp |
| `@sharptown/fastify-plugin` | [`packages/fastify`](packages/fastify) | Fastify-плагин с REST-эндпоинтом `POST /transform` |
| `@sharptown/client` | [`packages/client`](packages/client) | Изоморфный JS-клиент для браузера, Node.js, Bun и Deno |
| `@sharptown/server-rest` | [`packages/server-rest`](packages/server-rest) | REST-сервер на Fastify с подключенным плагином и статическим UI |
| `@sharptown/server-grpc` | [`packages/server-grpc`](packages/server-grpc) | gRPC-сервер с потоковой обработкой файлов |
| `@sharptown/server-jsonrpc` | [`packages/server-jsonrpc`](packages/server-jsonrpc) | JSON-RPC 2.0 через WebSocket |
| `@sharptown/example-vue` | [`examples/vue`](examples/vue) | Vue 3 + Vite пример с использованием JS-клиента |

## Возможности

- Конвертация в поддерживаемые Sharp форматы: WebP, PNG, JPEG, GIF, AVIF, HEIF и другие.
- Изменение размера: `width`, `height`, `dpr`, `aspectRatio`, `fit`, `background`.
- Кадрирование: `crop`, `cropOffset`, `smartCrop`.
- Ориентация: `autoOrient`, `rotate`, `flip`.
- Тон и цвет: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
  `colorize`, RGB `tint`, `grayscale`.
- Фильтры и эффекты: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
- Управление выводом: `convertTo`, `quality`, `progressive`, `stripMetadata`.
- Управление альфа-каналом: `removeAlpha`, `ensureAlpha`.
- Одинаковая модель операций для REST, gRPC, JSON-RPC и JS-клиента.
- Запуск локально или через Docker Compose.

## Быстрый старт

```bash
pnpm install
cp .env.example .env
pnpm dev
```

По умолчанию REST-сервер слушает `http://localhost:3001`.

Основные команды:

```bash
pnpm dev         # REST-сервер в watch-режиме, порт 3001
pnpm grpc        # gRPC-сервер, порт 50051
pnpm jsonrpc     # JSON-RPC-сервер через WebSocket, порт 3002
pnpm docs        # локальная документация
pnpm build       # сборка всех пакетов
```

REST, gRPC и JSON-RPC являются независимыми серверными пакетами. Каждый запускается отдельно и
использует общий `@sharptown/core`.

## REST API

REST-сервер предоставляет эндпоинт:

```http
POST /api/v1/transform
```

Изображение передается multipart-полем `image`, операции передаются query-параметрами.

| Параметр | Тип | Описание |
| -------- | --- | -------- |
| `width` | number | Ширина результата |
| `height` | number | Высота результата |
| `rotate` | number | Поворот в градусах |
| `flip` | boolean | Горизонтальное отражение |
| `blur` | number | Радиус размытия |
| `r`, `g`, `b` | number | RGB-оттенок |
| `grayscale`, `greyscale` | boolean | Перевод в оттенки серого |
| `removeAlpha` | boolean | Удаление альфа-канала |
| `ensureAlpha` | boolean | Добавление альфа-канала |
| `convertTo` | string | Формат вывода: `webp`, `png`, `jpg`, `gif`, `avif` и другие |

Пример запроса:

```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" \
  -o out.webp
```

Успешный ответ содержит бинарное изображение с корректным `content-type`. Ошибки
возвращаются в JSON:

```json
{
  "error": "Unsupported format"
}
```

Подробные параметры описаны в [`docs/src/content/docs/ru/rest-api.md`](docs/src/content/docs/ru/rest-api.md)
и [`docs/src/content/docs/ru/operations.md`](docs/src/content/docs/ru/operations.md).

## gRPC API

Пакет [`@sharptown/server-grpc`](packages/server-grpc) предоставляет сервис
`ImageProcessor` с двунаправленным стримингом. Входной файл передается чанками, результат
возвращается тоже чанками, поэтому сервер не собирает все изображение целиком в память.

Контракт находится в [`packages/server-grpc/proto/sharptown.proto`](packages/server-grpc/proto/sharptown.proto):

```proto
service ImageProcessor {
  rpc Transform(stream TransformRequest) returns (stream TransformResponse);
}
```

Запуск:

```bash
pnpm grpc
```

По умолчанию gRPC-сервер слушает `0.0.0.0:50051`. Хост и порт настраиваются через
`SHARPTOWN_GRPC_HOST` и `SHARPTOWN_GRPC_PORT`.

Пример клиента на Node.js:

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

Для больших файлов учитывайте ограничения форматов вывода. Например, WebP ограничен
размером `16383x16383` пикселей, JPEG ограничен `65535x65535` пикселей. Если изображение больше
лимита WebP, используйте JPEG или уменьшайте размер в том же запросе.

## JSON-RPC через WebSocket

Пакет [`@sharptown/server-jsonrpc`](packages/server-jsonrpc) предоставляет метод
`image.transform` через JSON-RPC 2.0 поверх WebSocket:

```text
ws://localhost:3002/rpc
```

Запуск:

```bash
pnpm jsonrpc
```

Файл передается как base64-строка в `params.image`, операции передаются в `params.options`.

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

Подробности: [`packages/server-jsonrpc`](packages/server-jsonrpc).

## JS-клиент

[`@sharptown/client`](packages/client): изоморфный JavaScript-клиент без зависимостей.
Он работает в браузере, Node.js, Bun и Deno, использует `fetch` и `FormData`.

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

Цепочка является thenable: `await` запускает запрос и возвращает `Blob`. Для других
форматов результата доступны терминальные методы `.arrayBuffer()`, `.bytes()`,
`.stream()`, `.response()` и `.toFile(path)`.

## Vue-пример

Демо на Vue 3 + Vite находится в [`examples/vue`](examples/vue). Оно позволяет выбрать
изображение, настроить операции и увидеть результат.

Сначала запустите REST-сервер, затем:

```bash
pnpm --filter @sharptown/example-vue dev
```

## Fastify-плагин

REST-преобразование также доступно как отдельный Fastify-плагин:
[`@sharptown/fastify-plugin`](packages/fastify).

```js
import Fastify from 'fastify'
import sharptown from '@sharptown/fastify-plugin'

const app = Fastify()

await app.register(sharptown, { prefix: '/api/v1' })
await app.listen({ port: 3001 })
```

Плагин регистрирует `POST /api/v1/transform` и использует общий движок
[`@sharptown/core`](packages/core). Новые адаптеры для Hono, Elysia, Express и других
фреймворков могут следовать тому же контракту:
[`packages/core#writing-a-new-adapter`](packages/core#writing-a-new-adapter).

## Docker

У каждого серверного пакета есть собственный Dockerfile. Собирать нужно из корня
репозитория:

```bash
docker build -f packages/server-rest/Dockerfile -t sharptown-rest .
docker run -p 3001:3001 -d sharptown-rest
```

`docker-compose.yml` описывает три сервиса:

| Сервис | Порт | Назначение |
| ------ | ---- | ---------- |
| `rest` | `3001` | REST API |
| `grpc` | `50051` | gRPC API |
| `jsonrpc` | `3002` | JSON-RPC через WebSocket |

```bash
cp .env.example .env          # опционально
docker compose up --build rest
docker compose up --build
```

## Документация

Документация находится в [`docs`](docs). Локальный запуск:

```bash
pnpm docs
```

Полезные разделы:

- [`docs/src/content/docs/ru/getting-started.md`](docs/src/content/docs/ru/getting-started.md)
- [`docs/src/content/docs/ru/rest-api.md`](docs/src/content/docs/ru/rest-api.md)
- [`docs/src/content/docs/ru/grpc-api.md`](docs/src/content/docs/ru/grpc-api.md)
- [`docs/src/content/docs/ru/jsonrpc-api.md`](docs/src/content/docs/ru/jsonrpc-api.md)
- [`docs/src/content/docs/ru/js-client.md`](docs/src/content/docs/ru/js-client.md)
- [`docs/src/content/docs/ru/deployment.md`](docs/src/content/docs/ru/deployment.md)

## Разработка

```bash
pnpm install
pnpm build
```

Перед pull request желательно проверить сборку и затронутые пакеты.

Типичный рабочий процесс:

1. Создайте ветку.
2. Внесите изменения.
3. Запустите релевантные проверки.
4. Откройте pull request.

## Планы

- Документационный сайт на Astro + Starlight.
- OpenAPI / Swagger для REST API.
- Дополнительные фильтры и операции обработки.
- Batch-обработка изображений.
