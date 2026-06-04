---
title: JSON-RPC API
description: JSON-RPC 2.0 поверх WebSocket с полезной нагрузкой в base64.
group: Transports
order: 3
---

# JSON-RPC API

`@sharptown/server-jsonrpc` предоставляет трансформацию как **JSON-RPC 2.0 поверх
WebSocket** по адресу `/rpc`. Это удобно для приложений, которые уже держат постоянный
сокет и хотят батчинг или уведомления.

По умолчанию работает на порту **3002** (`SHARPTOWN_JSONRPC_PORT` / `SHARPTOWN_JSONRPC_HOST`).

```bash
pnpm jsonrpc     # ws://localhost:3002/rpc
```

## Метод: `image.transform`

Изображения передаются как строки **base64** на вход и на выход.

**Параметры**

```ts
{
  image: string,                 // исходное изображение в base64 (обязательно)
  options?: TransformOptions     // те же операции, что и везде
}
```

**Результат**

```ts
{
  image: string,        // трансформированное изображение в base64
  format: string,       // например, "webp"
  contentType: string   // например, "image/webp"
}
```

## Пример обмена

Запрос:

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

Ответ:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "image": "<base64>",
    "format": "webp",
    "contentType": "image/webp"
  }
}
```

## Пример клиента в браузере

```js
const socket = new WebSocket('ws://localhost:3002/rpc')

function toBase64(arrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

socket.addEventListener('open', async () => {
  const buf = await file.arrayBuffer()
  socket.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'image.transform',
    params: { image: toBase64(buf), options: { width: 200, convertTo: 'webp' } },
  }))
})

socket.addEventListener('message', (event) => {
  const { result, error } = JSON.parse(event.data)
  if (error) throw new Error(error.message)
  const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: result.contentType })
  document.querySelector('img').src = URL.createObjectURL(blob)
})
```

## Покрытие спецификации

Сервер реализует основу JSON-RPC 2.0:

- **Одиночные запросы** с `id`.
- **Батчи** — массив запросов, на который приходит массив ответов.
- **Уведомления** — запросы без `id` не порождают ответа.

## Коды ошибок

| Код | Значение | Когда |
| --- | -------- | ----- |
| `-32700` | Ошибка разбора | Тело не является валидным JSON. |
| `-32600` | Неверный запрос | Не корректно сформированный запрос JSON-RPC. |
| `-32601` | Метод не найден | Неизвестное имя метода. |
| `-32602` | Неверные параметры | Отсутствует `image` или недопустимое значение операции. |
| `-32000` | Ошибка сервера | Неподдерживаемое или повреждённое изображение. |
| `-32603` | Внутренняя ошибка | Непредвиденный сбой. |
