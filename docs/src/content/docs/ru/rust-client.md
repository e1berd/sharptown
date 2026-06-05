---
title: Rust-клиент
description: Rust-клиент с транспортами REST и JSON-RPC, общим цепочечным билдером операций и потоковой REST-загрузкой больших изображений.
group: Guide
order: 7
---

# Rust-клиент

Rust-клиент даёт тот же цепочечный билдер операций, что и остальные клиенты Sharptown.
Сейчас поддерживаются **REST** (по умолчанию) и **JSON-RPC** поверх WebSocket.

Для больших исходных изображений используйте REST. `Input::path`, `Input::reader` и
`Input::url` стримятся в multipart-запрос, поэтому клиент не читает многогигабайтный атлас
в `Vec<u8>` перед загрузкой. JSON-RPC следует текущему контракту сервера (`params.image`
как одна base64-строка), поэтому он совместим, но не подходит для многогигабайтных входов.

## Установка

Rust-клиент **не опубликован на crates.io** — он лежит в репозитории в `clients/rust`.
Добавьте его как path-зависимость:

```toml
[dependencies]
sharptown-client = { path = "path/to/sharptown/clients/rust" }
```

Имя пакета — `sharptown-client`, имя library crate — `sharptown`:

```rust
use sharptown::{Client, Input};
```

## Создание клиента

```rust
use sharptown::{Client, Input};

let st = Client::new("http://localhost:3001")
    .with_header("authorization", "Bearer token");

let webp = st
    .transform(Input::path("photo.jpg"))
    .resize(800, 600)
    .blur(3)
    .grayscale()
    .convert("webp")
    .bytes()?;
# Ok::<(), sharptown::SharptownError>(())
```

## Выбор транспорта

```rust
use sharptown::{Client, JsonRpcTransport, RestTransport, Transport};

// REST (по умолчанию) — multipart POST на /api/v1/transform
let rest = Client::new("http://localhost:3001");

// REST с настройками endpoint
let rest_custom = Client::new("http://localhost:3001")
    .with_rest_transport(RestTransport::new().with_path("/api/v1/transform"));

// JSON-RPC поверх WebSocket — image.transform на /rpc
let rpc = Client::new("ws://localhost:3002")
    .with_transport(Transport::jsonrpc());

// JSON-RPC с настройками endpoint
let rpc_custom = Client::new("ws://localhost:3002")
    .with_jsonrpc_transport(JsonRpcTransport::new().with_method("image.transform"));
```

Базовый URL должен соответствовать выбранному транспорту. Если схема не указана,
используется защищённый вариант, как в остальных клиентах: `localhost:3001` становится
`https://localhost:3001`.

## Входы

```rust
Input::path("photo.jpg");                         // стримит файл с диска
Input::reader(file_or_stream, "atlas.tiff");      // стримит любой Read + Send источник
Input::bytes(bytes, "upload.png");                // байты в памяти
Input::url("https://example.com/photo.jpg");      // загружает по HTTP, затем стримит REST
```

Для очень больших файлов предпочитайте `Input::path` или `Input::reader` вместе с REST.
Ответ возвращается как `Vec<u8>` через `response()` / `bytes()`, как и в остальных
клиентах.

## Операции

Размер и кадрирование: `resize`, `width`, `height`, `crop`, `smart_crop`, `fit`,
`background`, `dpr`, `aspect_ratio`, `auto_orient`, `rotate`, `flip`.
Тон и цвет: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Фильтры и эффекты: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oil_paint`.
Альфа и вывод: `remove_alpha`, `ensure_alpha`, `convert`, `quality`, `progressive`,
`strip_metadata`, `keep_metadata`.

Как в Go-клиенте, первая недопустимая операция сохраняется в билдере и возвращается
терминальным методом. Её можно проверить заранее через `err()`.

## Терминальные методы

```rust
let response = st.transform(Input::path("photo.jpg")).convert("webp").response()?;
let bytes = st.transform(Input::path("photo.jpg")).convert("webp").bytes()?;
st.transform(Input::path("photo.jpg")).convert("webp").save("out.webp")?;
```

`Response` содержит `status`, `headers` и `body`, а также методы `content_type()` и
`save()`.

## Ошибки

```rust
match st.transform(Input::path("photo.jpg")).convert("webp").bytes() {
    Ok(bytes) => println!("{} bytes", bytes.len()),
    Err(err) => eprintln!("{:?}: {}", err.status, err.message),
}
```

## gRPC

gRPC в Rust-клиенте пока не реализован. Серверный протокол уже поддерживает
двунаправленный стриминг чанков, а Rust-клиент сохраняет общую модель операций для
будущего транспорта.

См. [REST API](/ru/docs/rest-api), [JSON-RPC API](/ru/docs/jsonrpc-api) и
[gRPC API](/ru/docs/grpc-api).
