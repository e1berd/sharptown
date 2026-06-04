---
title: Плагин Fastify
description: Добавьте маршрут трансформации в своё приложение Fastify или напишите новый адаптер.
group: Guide
order: 2
---

# Плагин Fastify

REST-трансформация поставляется отдельным плагином Fastify — `@sharptown/fastify`,
построенным поверх движка `@sharptown/core`, не зависящего от фреймворка. Подключите его в
любое приложение Fastify, чтобы получить маршрут `POST /transform`.

## Подключение

```js
import Fastify from 'fastify'
import sharptown from '@sharptown/fastify'

const app = Fastify()
await app.register(sharptown, { prefix: '/api/v1' })
await app.listen({ port: 3001 })

// → POST /api/v1/transform   (multipart-файл + ?width=500&convertTo=webp)
```

## Опции

| Опция | Тип | По умолчанию | Описание |
| ----- | --- | ------------ | -------- |
| `prefix` | строка | `/api/v1` | Префикс маршрута; маршрут становится `{prefix}/transform`. |
| `multipart` | объект | — | Опции, передаваемые в `@fastify/multipart`. |

Плагин регистрирует `@fastify/multipart` автоматически, **если ваше приложение этого ещё
не сделало**, — так что он чисто сочетается с приложениями, которые обрабатывают загрузки
в другом месте.

## Что он делает

Это тонкий адаптер поверх движка-ядра:

1. Извлекает первый загруженный файл из multipart-запроса.
2. Вызывает `transformBuffer(input, request.query)`.
3. Отправляет байты с корректным `Content-Type`.
4. Сопоставляет `InvalidOperationError` → `400`, сбои декодирования → `415`, отсутствие
   файла → `400`.

## Как написать новый адаптер

Поскольку вся работа с изображениями живёт в `@sharptown/core`, адаптеры для **Hono,
Elysia, Express** и других — крошечные. Контракт всегда один и тот же — четыре шага:

```js
import { transformBuffer, InvalidOperationError } from '@sharptown/core'

// Псевдокод для любого фреймворка:
async function handler(request, reply) {
  const file = await readUploadedFile(request)       // 1. получить байты
  if (!file) return reply.status(400).json({ error: 'No file uploaded' })

  try {
    const { data, contentType } = await transformBuffer(file, request.query) // 2. трансформировать
    return reply.header('content-type', contentType).send(data)              // 3. ответить
  } catch (error) {                                                          // 4. сопоставить ошибки
    if (error instanceof InvalidOperationError) {
      return reply.status(400).json({ error: error.message })
    }
    return reply.status(415).json({ error: 'Unsupported or corrupt image' })
  }
}
```

В этом и весь смысл паритета: напишите обвязку ввода/вывода для своего фреймворка — и
поведение обработки изображений достаётся бесплатно из общего ядра.
