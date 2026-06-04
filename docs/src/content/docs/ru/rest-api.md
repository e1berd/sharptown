---
title: REST API
description: Эндпоинт POST /api/v1/transform — параметры, запросы и ответы.
group: Transports
order: 1
---

# REST API

Транспорт REST — это вариант по умолчанию и самый простой: загрузите изображение как
`multipart/form-data`, передайте операции через параметры запроса и получите обратно
трансформированный бинарный файл.

Его обслуживает `@sharptown/server-rest` (Fastify + плагин `@sharptown/fastify-plugin` +
статический UI) на порту **3001** по умолчанию.

## Трансформация изображения

```
POST /api/v1/transform
Content-Type: multipart/form-data
```

- **Поле файла:** `image` (загрузка).
- **Операции:** параметры строки запроса (см. ниже).
- **Успех:** бинарное изображение с соответствующим заголовком `Content-Type`.
- **Ошибка:** JSON `{ "error": "..." }` со статусом `400` (неверные параметры) или `415`
  (неподдерживаемое / повреждённое изображение).

## Параметры запроса

Операции передаются параметрами строки запроса. Полный набор по группам:

- **Размер и кадрирование:** `width`, `height`, `dpr`, `aspectRatio`, `fit`, `background`, `smartCrop`, `crop`, `cropOffset`, `autoOrient`, `rotate`, `flip`.
- **Тон и цвет:** `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`, `colorize`, `r`, `g`, `b`, `grayscale`.
- **Фильтры и эффекты:** `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
- **Альфа и вывод:** `removeAlpha`, `ensureAlpha`, `convertTo`, `quality`, `progressive`, `stripMetadata`.

```bash
curl -X POST -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=800&aspectRatio=1.7778&smartCrop=true&saturation=1.2&convertTo=webp&quality=80" \
  --output out.webp
```

Каждый параметр, его тип, диапазон и порядок применения, а также правила валидации — в
[справочнике операций](/ru/docs/operations).

## Примеры

### curl

```bash
curl -X POST \
  -F "image=@input.jpg" \
  "http://localhost:3001/api/v1/transform?width=500&blur=3&convertTo=webp" \
  --output out.webp
```

### fetch (браузер)

```js
const form = new FormData()
form.append('image', fileInput.files[0])

const params = new URLSearchParams({ width: '800', convertTo: 'webp' })
const res = await fetch(`http://localhost:3001/api/v1/transform?${params}`, {
  method: 'POST',
  body: form,
})

if (!res.ok) throw new Error((await res.json()).error)
const blob = await res.blob()
document.querySelector('img').src = URL.createObjectURL(blob)
```

## Ответы

| Статус | Тело | Когда |
| ------ | ---- | ----- |
| `200` | бинарное изображение | Успех — см. заголовок `Content-Type`. |
| `400` | `{ "error": "No file uploaded" }` | В запросе нет поля `image`. |
| `400` | `{ "error": "Invalid <field> value" }` | Параметр вне диапазона / нечисловой. |
| `400` | `{ "error": "Invalid convert format target" }` | `convertTo` не поддерживается. |
| `415` | `{ "error": "Unsupported or corrupt image" }` | Загрузка не является декодируемым изображением. |

## CORS и статический UI

REST-хост включает разрешающий CORS (`origin: '*'`) и отдаёт небольшой статический UI по
адресу `/`, что удобно для прямых вызовов из браузерного приложения или
[JS-клиента](/ru/docs/js-client).

## Использование как плагин

Маршрут трансформации поставляется отдельным плагином Fastify, который можно подключить в
своё приложение — см. [Плагин Fastify](/ru/docs/fastify-plugin).
