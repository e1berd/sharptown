---
title: gRPC API
description: Двунаправленный стриминг трансформаций для файлов любого размера.
group: Transports
order: 2
---

# gRPC API

Помимо REST, Sharptown предоставляет gRPC-сервис `ImageProcessor` с **двунаправленным
стримингом**. Он спроектирован под файлы **любого размера** — например, PNG-карта `~3 ГБ`,
конвертируемая в WebP/JPEG.

Данные передаются чанками и **никогда не собираются целиком в память**: входной поток
пайпится прямо в Sharp, а результат отдаётся обратно потоком чанков. Backpressure
соблюдается в обе стороны.

Его обслуживает `@sharptown/server-grpc` на порту **50051** по умолчанию
(`SHARPTOWN_GRPC_PORT` / `SHARPTOWN_GRPC_HOST`).

## Контракт

Proto-файл лежит в `packages/server-grpc/proto/sharptown.proto`:

```proto
service ImageProcessor {
  // Первое сообщение — options, последующие — чанки байт.
  rpc Transform(stream TransformRequest) returns (stream TransformResponse);
}

message TransformOptions {
  optional uint32 width        = 1;
  optional uint32 height       = 2;
  optional int32  rotate       = 3;
  bool            flip         = 4;
  optional uint32 blur         = 5;
  optional uint32 tint_r       = 6;
  optional uint32 tint_g       = 7;
  optional uint32 tint_b       = 8;
  bool            grayscale    = 9;
  bool            remove_alpha = 10;
  bool            ensure_alpha = 11;
  string          convert_to   = 12; // webp/png/jpg/jpeg/avif/gif/heif; пусто = без изменений

  // Размер и кадрирование
  string          crop          = 13; // "x,y,w,h" или "WxH"
  string          crop_offset   = 14; // "x,y" для формы "WxH"
  bool            smart_crop    = 15;
  string          fit           = 16; // cover/contain/fill/inside/outside
  string          background    = 17;
  bool            auto_orient   = 18;
  optional double dpr           = 19;
  optional double aspect_ratio  = 20;

  // Тон и цвет
  optional double brightness    = 21; // -100..100
  optional double contrast      = 22; // -100..100
  optional double saturation    = 23; // 0..2
  optional double exposure      = 24; // EV -3..3
  optional double hue           = 25; // 0..360
  optional double gamma         = 26; // 1.0..3.0
  string          colorize      = 27;

  // Фильтры
  optional double sepia         = 28; // 0..1
  bool            invert        = 29;
  optional uint32 threshold     = 30; // 0..255
  optional double sharpen       = 31; // 0..5
  optional uint32 oil_paint     = 32;

  // Вывод
  optional uint32 quality        = 33; // 1..100
  bool            progressive    = 34;
  optional bool   strip_metadata = 35; // не задано — удалить; false — сохранить
}

message TransformRequest {
  oneof payload {
    TransformOptions options = 1; // ровно первое сообщение
    bytes            chunk   = 2; // последующие сообщения с данными
  }
}

message TransformResponse {
  bytes chunk = 1;
}
```

`TransformOptions` полностью паритетен REST `/api/v1/transform` и JS-клиенту — отличаются
лишь имена полей по соглашению proto (`tint_r`, `smart_crop`, `convert_to`). Каждый
параметр описан в [справочнике операций](/ru/docs/operations).

## Протокол стриминга

1. Откройте поток `Transform`.
2. Отправьте **ровно одно** сообщение `options` первым.
3. Отправьте исходный файл последовательностью сообщений `chunk`.
4. Вызовите `end()` на клиентском потоке.
5. Читайте обратно трансформированное изображение последовательностью `chunk` до `end`.

```mermaid
sequenceDiagram
  participant C as Клиент
  participant S as Sharptown gRPC
  C->>S: options (первое сообщение)
  C->>S: chunk
  C->>S: chunk
  C-->>S: end()
  S-->>C: chunk
  S-->>C: chunk
  S-->>C: end
```

## Запуск

```bash
pnpm install
cp .env.example .env
pnpm grpc        # dev (watch)
```

## Пример клиента на Node.js

```js
import * as grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { createReadStream, createWriteStream } from 'node:fs'

const def = protoLoader.loadSync('packages/server-grpc/proto/sharptown.proto', {
  keepCase: false, oneofs: true, defaults: true,
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

// 1) options, затем 2) поток байт исходника
call.write({ options: { width: 4096, convertTo: 'webp' } })
const src = createReadStream('map-3gb.png')
src.on('data', (chunk) => call.write({ chunk }))
src.on('end', () => call.end())
```

## Заметки о больших файлах

Память остаётся плоской благодаря стримингу плюс `sequentialRead`. Учитывайте пиксельные
лимиты форматов вывода (WebP `16383²`, JPEG `65535²`), описанные в
[справочнике операций](/ru/docs/operations#лимиты-для-больших-файлов-стриминг--grpc). Для
гигабайтных карт предпочтительны `resize` / `convert` / `flip`; произвольный `rotate`
может стоить больше памяти.
