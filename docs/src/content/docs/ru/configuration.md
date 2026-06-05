---
title: Конфигурация
description: Переменные окружения и порты для каждого сервера.
group: Introduction
order: 4
---

# Конфигурация

Каждый сервер настраивается через переменные окружения, загружаемые из файла `.env` в
корне репозитория (`node --env-file=.env`). Скопируйте пример, чтобы начать:

```bash
cp .env.example .env
```

## Переменные окружения

| Переменная | По умолчанию | Используется | Описание |
| ---------- | ------------ | ------------ | -------- |
| `SHARPTOWN_PORT` | `3001` | REST | Порт REST-сервера. |
| `SHARPTOWN_HOST` | `localhost` | REST | Адрес привязки REST-сервера. |
| `SHARPTOWN_GRPC_PORT` | `50051` | gRPC | Порт gRPC-сервера. |
| `SHARPTOWN_GRPC_HOST` | `0.0.0.0` | gRPC | Адрес привязки gRPC-сервера. |
| `SHARPTOWN_JSONRPC_PORT` | `3002` | JSON-RPC | Порт WebSocket-сервера. |
| `SHARPTOWN_JSONRPC_HOST` | `localhost` | JSON-RPC | Адрес привязки WebSocket-сервера. |
| `SHARPTOWN_PROXY_KEY` | _(пусто)_ | REST | HMAC-секрет для [подписанного image-прокси](/ru/docs/image-proxy). Пусто — прокси выключен. |
| `SHARPTOWN_PROXY_ALLOWED_HOSTS` | `*` | REST | Список разрешённых хостов-источников через запятую; `*` — любой публичный хост. Приватные/loopback-адреса блокируются всегда. |
| `SHARPTOWN_PROXY_TIMEOUT_MS` | `5000` | REST | Таймаут загрузки источника, мс. |
| `SHARPTOWN_PROXY_MAX_BYTES` | `20971520` | REST | Максимальный размер исходного изображения, байт. |
| `SHARPTOWN_PROXY_CACHE_CONTROL` | `public, max-age=31536000, immutable` | REST | `Cache-Control` для ответов прокси; пусто — заголовок не добавляется. |

Пример `.env`:

```ini
SHARPTOWN_PORT=3001
SHARPTOWN_HOST=localhost
SHARPTOWN_GRPC_PORT=50051
SHARPTOWN_GRPC_HOST=0.0.0.0
SHARPTOWN_JSONRPC_PORT=3002
SHARPTOWN_JSONRPC_HOST=localhost
SHARPTOWN_PROXY_KEY=
SHARPTOWN_PROXY_ALLOWED_HOSTS=*
```

## Примечания

- Серверы читают эти значения при запуске; перезапустите их после изменения `.env`.
- В Docker адрес привязки принудительно устанавливается в `0.0.0.0`, чтобы контейнер был
  доступен — см. [Развёртывание](/ru/docs/deployment).
- `0.0.0.0` слушает все интерфейсы (используйте внутри контейнеров / в доверенных сетях);
  `localhost` ограничивает доступ локальной машиной.
