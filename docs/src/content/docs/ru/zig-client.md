---
title: Zig-клиент
description: Zig-клиент с транспортами REST и JSON-RPC, общими именами операций и потоковой REST-загрузкой файлов.
group: Guide
order: 8
---

# Zig-клиент

Zig-клиент повторяет имена операций и REST-сериализацию, которые используются в остальных
клиентах Sharptown. Сейчас поддерживаются **REST** (по умолчанию) и **JSON-RPC** поверх
WebSocket.

Для больших исходных изображений используйте REST. `Input.fromPath` стримит файл в
multipart-запрос без сборки полного тела запроса в памяти. JSON-RPC следует текущему
контракту сервера (`params.image` как одна base64-строка), поэтому он совместим, но не
подходит для многогигабайтных входов.

## Установка

Zig-клиент **не опубликован в реестр пакетов** — он лежит в репозитории в `clients/zig`.
Добавьте этот каталог как зависимость Zig-проекта или импортируйте `src/sharptown.zig`
напрямую.

Запуск тестов из каталога клиента:

```bash
zig build test
```

## Создание клиента

```zig
const std = @import("std");
const sharptown = @import("sharptown");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const client = sharptown.Client.init(allocator, "http://localhost:3001");
    var transform = client.transform(sharptown.Input.fromPath("photo.jpg"));

    _ = try transform.resize(800, 600);
    _ = try transform.blur(3);
    _ = transform.grayscale();
    _ = try transform.convert("webp");

    const response = try transform.response();
    defer response.deinit();

    try response.save("out.webp");
}
```

## Выбор транспорта

```zig
// REST (по умолчанию) — multipart POST на /api/v1/transform
const rest = sharptown.Client.init(allocator, "http://localhost:3001");

// REST с настройками endpoint
const rest_custom = sharptown.Client
    .init(allocator, "http://localhost:3001")
    .withRestTransport(.{ .path = "/api/v1/transform", .field = "image" });

// JSON-RPC поверх WebSocket — image.transform на /rpc
const rpc = sharptown.Client
    .init(allocator, "ws://localhost:3002")
    .withJsonRpcTransport(.{ .path = "/rpc", .method = "image.transform" });
```

Zig-транспорт JSON-RPC сейчас поддерживает обычный `ws://`. `wss://` можно добавить позже
через TLS-слой для WebSocket.

## Входы

```zig
sharptown.Input.fromPath("photo.jpg");                         // стримит файл с диска
sharptown.Input.fromBytes(bytes, "upload.png");                // байты в памяти
sharptown.Input.fromUrl("https://example.com/photo.jpg", null); // загружает по HTTP
```

Для очень больших файлов предпочитайте `Input.fromPath` вместе с REST. `Input.fromUrl`
сейчас сначала скачивает удалённый файл.

## Операции

Размер и кадрирование: `resize`, `width`, `height`, `crop`, `smartCrop`, `fit`,
`background`, `dpr`, `aspectRatio`, `autoOrient`, `rotate`, `flip`.
Тон и цвет: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Фильтры и эффекты: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
Альфа и вывод: `removeAlpha`, `ensureAlpha`, `convert`, `quality`, `progressive`,
`stripMetadata`, `keepMetadata`.

## Заголовки

```zig
const headers = [_]sharptown.Header{
    .{ .name = "authorization", .value = "Bearer token" },
};

const client = sharptown.Client
    .init(allocator, "http://localhost:3001")
    .withHeaders(&headers);
```

## Терминальные методы

```zig
const response = try transform.response();
defer response.deinit();

try response.save("out.webp");
```

`Response` содержит `status`, необязательный `content_type` и владеющие `body`-байты.
После использования вызывайте `deinit()`.

## gRPC

gRPC в Zig-клиенте пока не реализован. Серверный протокол уже поддерживает
двунаправленный стриминг чанков; для аккуратной реализации нужны protobuf bindings и
Zig-форма streaming API.

См. [REST API](/ru/docs/rest-api), [JSON-RPC API](/ru/docs/jsonrpc-api) и
[gRPC API](/ru/docs/grpc-api).
