---
title: Быстрый старт
description: Установите монорепозиторий и выполните первую трансформацию меньше чем за минуту.
group: Introduction
order: 2
---

# Быстрый старт

Sharptown — это рабочее пространство [pnpm](https://pnpm.io). Меньше чем за минуту у вас
будет запущенный сервер и первое оптимизированное изображение.

## Требования

- **Node.js ≥ 18** (разработка ведётся на Node 24).
- **pnpm** (`npm i -g pnpm`).

## Установка

```bash
git clone https://github.com/e1berd/sharptown.git
cd sharptown
pnpm install          # установит все рабочие пакеты
cp .env.example .env  # необязательно — разумные значения встроены по умолчанию
```

## Запуск сервера

Каждый транспорт — это независимый пакет со своим скриптом:

```bash
pnpm dev        # REST-сервер в режиме watch       → http://localhost:3001
pnpm grpc       # gRPC streaming-сервер             → 0.0.0.0:50051
pnpm jsonrpc    # JSON-RPC поверх WebSocket          → ws://localhost:3002/rpc
pnpm build      # сгенерировать декларации типов всех пакетов
```

Три транспорта — это **независимые пакеты-серверы**, все они используют общий
`@sharptown/core`. Запустите один или все три сразу.

## Первая трансформация (REST)

С запущенным REST-сервером оптимизируйте изображение в WebP одним `curl`:

```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" \
  --output out.webp
```

При успехе вы получаете обратно **бинарное изображение** с корректным `Content-Type`
(здесь — `image/webp`). При ошибке возвращается JSON:

```json
{ "error": "Unsupported format" }
```

## Первая трансформация (JS-клиент)

Предпочитаете код? Клиент делает всё выразительным и цепочечным:

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')

const webp = await st
  .transform(file)   // File, Blob, Buffer, URL или путь
  .resize(800, 600)
  .blur(3)
  .grayscale()
  .convert('webp')   // разрешается в Blob

// В браузере:
document.querySelector('img').src = URL.createObjectURL(webp)
```

## Попробуйте вживую

[Песочница](/ru/playground) собирает такие цепочки за вас и выполняет их на сервере,
URL которого вы укажете, — быстрый способ почувствовать API до написания кода.

## Дальнейшие шаги

- [Конфигурация](/ru/docs/configuration) — переменные окружения и порты.
- [REST API](/ru/docs/rest-api) — полный контракт эндпоинта.
- [Развёртывание](/ru/docs/deployment) — Docker и docker-compose.
