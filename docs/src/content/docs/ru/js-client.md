---
title: JS-клиент
description: Выразительный цепочечный изоморфный клиент для браузера, Node, Bun и Deno.
group: Guide
order: 1
---

# JS-клиент

`@sharptown/client` — это выразительный **изоморфный** клиент: он работает без изменений в
браузере, Node, Bun и Deno. По умолчанию он говорит на REST-транспорте, с подключаемым
интерфейсом транспорта, так что позже можно добавить другие.

## Создание клиента

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')
```

`sharptown(url, options?)` принимает строку или `URL`, плюс опции:

| Опция | Тип | По умолчанию | Назначение |
| ----- | --- | ------------ | ---------- |
| `transport` | `Transport` | `rest()` | Подключаемый транспорт. |
| `fetch` | `function` | `globalThis.fetch` | Свой fetch (Node < 18, прокси, тесты). |
| `headers` | `object` | `{}` | Заголовки по умолчанию для каждого запроса (например, авторизация). |

## Цепочка трансформации

`st.transform(input)` возвращает цепочечный **`TransformBuilder`**. Каждый метод операции
возвращает `this`, так что можно плавно собрать конвейер и завершить терминалом.

```js
const blob = await st
  .transform(file)
  .resize(800, 600)
  .blur(3)
  .grayscale()
  .convert('webp')   // await разрешается в Blob
```

### Принимаемые входные данные

`transform(input)` принимает любое из:

- `Blob` / `File` — используется как есть.
- `ArrayBuffer`, `Uint8Array`, любой `TypedArray` / `DataView` (включая Node `Buffer`).
- `ReadableStream` — веб-поток.
- `string` — URL вида `http(s)://…` (загружается) **или** путь к файлу (Node/Bun/Deno).
- `URL` — URL со схемой `http(s):` или `file:`.

### Методы операций

Размер и кадрирование:

| Метод | Описание |
| ----- | -------- |
| `.resize(width, height?)` | Изменение размера. Также принимает `{ width, height }`. |
| `.width(n)` / `.height(n)` | Задать одно измерение. |
| `.crop(x, y, w, h)` | Обрезка прямоугольника. Также принимает `{ left, top, width, height }`. |
| `.smartCrop(enabled = true)` | Обрезка к значимой области при ресайзе. |
| `.fit(mode)` | `cover` / `contain` / `fill` / `inside` / `outside`. |
| `.background(color)` | Фон для `fit: 'contain'`. |
| `.dpr(value)` | Device pixel ratio; умножает целевой размер. |
| `.aspectRatio(ratio)` | Целевое соотношение; вместе с `.width()`/`.height()`. |
| `.autoOrient(enabled = true)` | Поворот по ориентации EXIF. |
| `.rotate(deg)` | Поворот на градусы. |
| `.flip(enabled = true)` | Отражение по горизонтали. |

Тон, цвет и эффекты:

| Метод | Описание |
| ----- | -------- |
| `.brightness(n)` | Яркость `-100`–`100`. |
| `.contrast(n)` | Контраст `-100`–`100`. |
| `.saturation(n)` | Насыщенность `0`–`2`. |
| `.exposure(n)` | Экспозиция в EV `-3`–`3`. |
| `.hue(n)` | Сдвиг оттенка `0`–`360`. |
| `.gamma(n)` | Гамма `1.0`–`3.0`. |
| `.colorize(color)` | Перевод в оттенки одного цвета. |
| `.tint(r, g, b)` | Тонирование. Также принимает `{ r, g, b }`. |
| `.grayscale(enabled = true)` | Обесцвечивание (`.greyscale` — синоним). |
| `.blur(sigma = 1)` | Размытие по Гауссу. |
| `.sharpen(sigma?)` | Резкость; без аргумента — значение по умолчанию. |
| `.sepia(intensity = 1)` | Сепия `0`–`1`. |
| `.invert(enabled = true)` | Инверсия цветов. |
| `.threshold(n)` | Бинаризация по порогу `0`–`255`. |
| `.oilPaint(size = 3)` | Эффект масляной краски (медиана). |

Альфа и вывод:

| Метод | Описание |
| ----- | -------- |
| `.removeAlpha()` / `.ensureAlpha()` | Управление альфа-каналом. |
| `.quality(n)` | Качество вывода `1`–`100` (с `.convert()`). |
| `.progressive(enabled = true)` | Прогрессивный вывод. |
| `.stripMetadata(enabled = true)` | Удалить EXIF (по умолчанию); `false` — сохранить. |
| `.convert(format)` | Формат вывода (`.toFormat` — синоним). |
| `.abortWith(signal)` | Прикрепить `AbortSignal`. |

Валидация происходит **на стороне клиента, до запроса** — неверные значения сразу
выбрасывают `SharptownError`.

### Терминалы

Билдер является *thenable*: `await builder` разрешается в `Blob`. Либо завершите явно:

| Терминал | Возвращает |
| -------- | ---------- |
| `await builder` / `.blob()` | `Blob` |
| `.arrayBuffer()` | `ArrayBuffer` |
| `.bytes()` | `Uint8Array` |
| `.response()` | сырой `Response` (заголовки, стриминг) |
| `.stream()` | тело `ReadableStream` |
| `.toFile(path)` | запись на диск (Node/Bun/Deno), возвращает путь |

```js
// Изучить заголовки
const res = await st.transform(file).convert('webp').response()
console.log(res.headers.get('content-type')) // image/webp

// Node: сразу на диск
await st.transform('./in.jpg').resize(1024).convert('avif').toFile('./out.avif')
```

## Сокращения

Для разовых операций пропустите цепочку:

```js
const png   = await st.convert(file, 'png')
const small = await st.resize(file, 320, 240)
```

## Обработка ошибок

```js
import { SharptownError } from '@sharptown/client'

try {
  await st.transform(file).convert('webp')
} catch (error) {
  if (error instanceof SharptownError) {
    console.error(error.status, error.message, error.body)
  }
}
```

`SharptownError` несёт `status` (HTTP-статус, когда ошибка пришла с сервера) и `body`
(разобранную нагрузку `{ error }`, если она есть).

## Свой транспорт / заголовки

```js
import { sharptown, rest } from '@sharptown/client'

const st = sharptown('http://localhost:3001', {
  transport: rest({ field: 'image', path: '/api/v1/transform' }),
  headers: { authorization: 'Bearer …' },
})
```

## Экспорты

```js
import {
  sharptown,        // фабрика
  SharptownClient,  // класс клиента
  TransformBuilder, // цепочечный билдер
  rest,             // фабрика REST-транспорта
  SharptownError,   // тип ошибки
  SUPPORTED_FORMATS // неизменяемый список форматов вывода
} from '@sharptown/client'
```
