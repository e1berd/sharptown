---
title: Go-клиент
description: Выразительный Go-клиент со всеми тремя транспортами — REST, JSON-RPC и gRPC — со стримингом прямо из любого io.Reader.
group: Guide
order: 4
---

# Go-клиент

Go-клиент даёт единый цепочечный API для **всех трёх транспортов** — REST (по умолчанию),
JSON-RPC и **gRPC** — выбираемых при создании клиента. Изображения стримятся прямо из любого
`io.Reader` (`*os.File`, multipart-загрузка, буфер в памяти), поэтому фото можно
трансформировать **целиком в памяти, не трогая диск**.

## Установка

Go-клиент **не опубликован в реестр пакетов** — он лежит в репозитории в `clients/go`.
Go забирает его прямо из GitHub:

```bash
go get github.com/e1berd/sharptown/clients/go
```

```go
import sharptown "github.com/e1berd/sharptown/clients/go"
```

Используется стандартная библиотека для REST плюс `coder/websocket` (JSON-RPC) и `grpc-go`
(gRPC); сгенерированные gRPC-стабы закоммичены, так что кодогенерация для сборки не нужна.

## Создание клиента

```go
c := sharptown.New("http://localhost:3001",
    sharptown.WithTimeout(15*time.Second),
    sharptown.WithHeader("authorization", "Bearer …"),
)
```

Опции: `WithTransport`, `WithHeaders`, `WithHeader`, `WithTimeout`, `WithHTTPClient`.
Базовый URL должен соответствовать выбранному транспорту. Схему можно не указывать — голый
хост вида `localhost:3001` по умолчанию использует защищённый вариант (`https://`, либо
`wss://` для JSON-RPC); для незащищённого подключения укажите `http://` (или `ws://`) явно.

## Выбор транспорта

```go
// REST (по умолчанию) — multipart POST на /api/v1/transform
sharptown.New("http://localhost:3001")

// JSON-RPC поверх WebSocket — image.transform на /rpc
sharptown.New("ws://localhost:3002", sharptown.WithTransport(sharptown.JSONRPC()))

// gRPC — sharptown.v1.ImageProcessor/Transform (двунаправленный стрим)
sharptown.New("localhost:50051", sharptown.WithTransport(sharptown.GRPC()))
```

Все транспорты принимают один и тот же билдер и возвращают один и тот же `*Response`,
поэтому замена транспорта не меняет код вызова.

## Входы — без диска

```go
sharptown.File(f)                  // стандартный *os.File (имя берётся из файла)
sharptown.Reader(r, "photo.jpg")   // любой io.Reader: multipart.File, bytes.Buffer, поток…
sharptown.Bytes(buf, "photo.jpg")  // []byte в памяти
sharptown.Path("photo.jpg")        // удобство: чтение с диска
sharptown.URL("https://…/cat.jpg") // удобство: загрузка по HTTP
```

Типичный HTTP-хендлер, целиком в памяти:

```go
func handler(w http.ResponseWriter, r *http.Request) {
    file, hdr, _ := r.FormFile("image")
    defer file.Close()

    data, err := c.Transform(sharptown.Reader(file, hdr.Filename)).
        Width(1024).Convert("webp").Bytes(r.Context())
    // …
}
```

## Операции

Размер и кадрирование: `Resize`, `Width`, `Height`, `Crop`, `SmartCrop`, `Fit`,
`Background`, `DPR`, `AspectRatio`, `AutoOrient`, `Rotate`, `Flip`.
Тон и цвет: `Brightness`, `Contrast`, `Saturation`, `Exposure`, `Hue`, `Gamma`,
`Colorize`, `Tint`, `Grayscale`.
Фильтры и эффекты: `Blur`, `Sharpen`, `Sepia`, `Invert`, `Threshold`, `OilPaint`.
Альфа и вывод: `RemoveAlpha`, `EnsureAlpha`, `Convert`, `Quality`, `Progressive`,
`StripMetadata`, `KeepMetadata`.

Первая недопустимая величина (вне диапазона, неподдерживаемый формат) запоминается и
возвращается терминальным методом — либо проверьте `Err()` заранее.

## Терминальные методы

```go
res, err := t.Do(ctx)        // *Response (Status, Header, Body)
data, err := t.Bytes(ctx)    // []byte, остаётся в памяти
err := t.Save(ctx, "out.webp")
```

## Ошибки

```go
var se *sharptown.Error
if errors.As(err, &se) {
    log.Println(se.Status, se.Message) // HTTP-статус / код RPC + сообщение
}
```

## Подписанный image-прокси

Постройте подписанный URL для эндпоинта [`GET /fetch`](/ru/docs/image-proxy) — его можно
вставить прямо в `<img src>`: сервер скачает, преобразует и закэширует удалённое изображение.
Задайте общий секрет через `WithProxySecret` (серверный `SHARPTOWN_PROXY_KEY`).

```go
c := sharptown.New("https://img.example.com", sharptown.WithProxySecret(secret))

src, err := c.SignedURL("https://example.com/photo.jpg", map[string]any{
    "width": 800, "convertTo": "webp",
})
```

`(*Transform).SignedURL(source)` подписывает операции, накопленные в билдере.

## Транспорты

Один и тот же клиент говорит на всех транспортах Sharptown. См. [REST API](/ru/docs/rest-api),
[JSON-RPC API](/ru/docs/jsonrpc-api) и [gRPC API](/ru/docs/grpc-api).
