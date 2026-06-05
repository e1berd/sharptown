---
title: Elixir-клиент
description: Elixir-клиент без зависимостей с дружелюбным к пайпам API для транспортов REST и JSON-RPC.
group: Guide
order: 5
---

# Elixir-клиент

Elixir-клиент **без зависимостей** и удобен для пайпов. Сейчас он поддерживает транспорты
**REST** (по умолчанию) и **JSON-RPC** (gRPC в работе), с единым цепочечным API.

## Установка

Elixir-клиент **не опубликован на Hex** — он лежит в репозитории в `clients/elixir`.
Добавьте его как Mix git-зависимость, указывающую на этот подкаталог:

```elixir
def deps do
  [{:sharptown, github: "e1berd/sharptown", sparse: "clients/elixir"}]
end
```

Без сторонних зависимостей — REST на `:httpc`, JSON-RPC на встроенном WebSocket-клиенте
поверх `:gen_tcp`/`:ssl`, JSON через модуль OTP `:json`. **Требуется OTP 27+.**

## Создание клиента

```elixir
Sharptown.client("http://localhost:3001")
```

Опции: `:transport` (по умолчанию `Sharptown.rest()`), `:headers`, `:timeout` (мс).
Базовый URL должен соответствовать выбранному транспорту. Схему можно не указывать — голый
хост вида `localhost:3001` по умолчанию использует защищённый вариант (`https://`, либо
`wss://` для JSON-RPC); для незащищённого подключения укажите `http://` (или `ws://`) явно.

## Выбор транспорта

```elixir
# REST (по умолчанию) — multipart POST на /api/v1/transform
Sharptown.client("http://localhost:3001")

# JSON-RPC поверх WebSocket — image.transform на /rpc
Sharptown.client("ws://localhost:3002", transport: Sharptown.jsonrpc())
```

## Цепочка трансформации

```elixir
{:ok, response} =
  Sharptown.client("http://localhost:3001")
  |> Sharptown.transform("photo.jpg")
  |> Sharptown.resize(800, 600)
  |> Sharptown.blur(3)
  |> Sharptown.grayscale()
  |> Sharptown.convert(:webp)
  |> Sharptown.run()
```

### Входы

Обычная строка — это `http(s)`-URL или путь к существующему файлу. Для сырых байтов или
других источников используйте кортеж:

```elixir
Sharptown.transform(client, "photo.jpg")                    # путь к файлу
Sharptown.transform(client, "https://example.com/cat.jpg")  # загрузка по HTTP
Sharptown.transform(client, {:bytes, data, "upload.png"})   # сырые байты, без диска
Sharptown.transform(client, {:file, "photo.jpg"})
Sharptown.transform(client, {:url, "https://…/cat.jpg"})
```

### Операции

Размер и кадрирование: `resize/3`, `width/2`, `height/2`, `crop/5`, `smart_crop/2`,
`fit/2`, `background/2`, `dpr/2`, `aspect_ratio/2`, `auto_orient/2`, `rotate/2`, `flip/2`.
Тон и цвет: `brightness/2`, `contrast/2`, `saturation/2`, `exposure/2`, `hue/2`, `gamma/2`,
`colorize/2`, `tint/4`, `grayscale/2`.
Фильтры и эффекты: `blur/2`, `sharpen/2`, `sepia/2`, `invert/2`, `threshold/2`,
`oil_paint/2`.
Альфа и вывод: `remove_alpha/2`, `ensure_alpha/2`, `convert/2`, `quality/2`,
`progressive/2`, `strip_metadata/2`.

Значения проверяются до запроса; величина вне диапазона или неподдерживаемый формат бросают
`Sharptown.Error`.

### Запуск

```elixir
{:ok, %Sharptown.Response{} = res} = Sharptown.run(transform)
res.status                              # 200
Sharptown.Response.content_type(res)    # "image/webp"
res.body                                # бинарные данные изображения

{:ok, bytes} = Sharptown.bytes(transform)
{:ok, path}  = Sharptown.to_file(transform, "out.webp")

# bang-варианты бросают при ошибке
res = Sharptown.run!(transform)
```

## Обработка ошибок

`run/1`, `bytes/1` и `to_file/2` возвращают `{:error, %Sharptown.Error{}}` при ошибках
сервера и сети; `!`-варианты бросают. `Sharptown.Error` несёт `:status` (HTTP-статус или код
RPC) и `:body`.

```elixir
case Sharptown.run(transform) do
  {:ok, response} -> response.body
  {:error, %Sharptown.Error{status: status, message: message}} -> {status, message}
end
```

## Транспорты

Один и тот же клиент говорит на всех транспортах Sharptown. См. [REST API](/ru/docs/rest-api)
и [JSON-RPC API](/ru/docs/jsonrpc-api). Поддержка gRPC в работе.
