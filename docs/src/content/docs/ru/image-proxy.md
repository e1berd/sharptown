---
title: Подписанный image-прокси
description: Преобразование удалённых изображений на лету по подписанному URL — с HMAC-подписью запроса, защитой от SSRF и долгоживущим кэшем.
group: Transports
order: 4
---

# Подписанный image-прокси

REST-сервер умеет преобразовывать **удалённое** изображение по URL, а не только
загруженный файл, — результат можно вставить прямо в `<img src>`. Сервер скачивает
источник, применяет те же операции, что и `POST /transform`, и возвращает результат с
долгоживущими заголовками кэша: тяжёлая работа выполняется один раз на уникальный URL, а
дальше отдаёт CDN или браузер.

```http
GET /api/v1/fetch?url=<источник>&width=800&convertTo=webp&sig=<подпись>
```

## Включение

Прокси выключен, пока не задан HMAC-секрет. Настраивается переменными окружения
`SHARPTOWN_PROXY_*` (см. [Конфигурацию](/ru/docs/configuration)):

```ini
SHARPTOWN_PROXY_KEY=длинный-случайный-секрет
SHARPTOWN_PROXY_ALLOWED_HOSTS=*
```

При пустом `SHARPTOWN_PROXY_KEY` эндпоинт `GET /api/v1/fetch` отвечает `503` — режима без
подписи (открытого прокси) не существует.

## Подпись

Каждый запрос обязан содержать параметр `sig` — base64url HMAC-SHA256 канонической строки
запроса с ключом `SHARPTOWN_PROXY_KEY`. Каноническая строка — это все параметры, кроме
`sig` (включая `url`), как декодированные пары `key=value`, **отсортированные по ключу** и
соединённые через `&`:

```text
blur=3&convertTo=webp&url=https://example.com/a.jpg&width=800
```

Подпись покрывает URL источника и все операции, поэтому подменить параметры нельзя. Порядок
параметров в итоговом URL значения не имеет — подписывается только отсортированная
каноническая форма.

Каждый клиент строит подписанный URL сам, поэтому вручную подписывать почти не приходится:

```js
// JavaScript
import { sharptown } from '@sharptown/client'

const st = sharptown('https://img.example.com', { proxySecret: process.env.SHARPTOWN_PROXY_KEY })
const src = await st.signedUrl('https://example.com/photo.jpg', { width: 800, convertTo: 'webp' })
```

Аналогичный метод в остальных клиентах:

| Клиент | Метод |
| ------ | ----- |
| JavaScript | `client.signedUrl(source, operations)` |
| Go | `client.SignedURL(source, ops)` |
| PHP | `$client->signedUrl($source, $operations)` |
| Elixir | `Sharptown.signed_url(client, source, operations)` |
| Dart/Flutter | `client.signedUrl(source, operations)` |
| Rust | `client.signed_url(source, &ops)` |

## Безопасность

Прокси спроектирован как закрытый и «вежливый» загрузчик:

- **Только по подписи.** Запросы без корректного `sig` отклоняются (`401`/`403`).
- **Защита от SSRF.** Приватные, loopback-, link-local- и cloud-metadata-адреса блокируются
  даже при `SHARPTOWN_PROXY_ALLOWED_HOSTS=*`, причём имя хоста резолвится до загрузки. Задайте
  allowlist (например, `cdn.example.com,*.images.example.com`), чтобы ограничить источники.
- **Без редиректов.** Редирект обошёл бы проверки исходного URL, поэтому ответы 3xx
  отклоняются.
- **Ограниченная загрузка.** Запрос к источнику ограничен `SHARPTOWN_PROXY_TIMEOUT_MS` и
  `SHARPTOWN_PROXY_MAX_BYTES`.

## Кэширование

Успешные ответы содержат `Cache-Control` (`SHARPTOWN_PROXY_CACHE_CONTROL`, по умолчанию
неизменяемая политика на год) и `ETag`, а также поддерживают `If-None-Match` с ответом
`304 Not Modified`. Таким образом преобразованное изображение вычисляется один раз и
переиспользуется всеми кэшами перед сервером. Ключ кэша — полный подписанный URL, поэтому
результат постоянен: если изображение по URL меняется, версионируйте URL или уменьшайте
`max-age`.
