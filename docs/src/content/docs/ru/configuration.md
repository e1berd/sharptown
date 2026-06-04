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

Пример `.env`:

```ini
SHARPTOWN_PORT=3001
SHARPTOWN_HOST=localhost
SHARPTOWN_GRPC_PORT=50051
SHARPTOWN_GRPC_HOST=0.0.0.0
SHARPTOWN_JSONRPC_PORT=3002
SHARPTOWN_JSONRPC_HOST=localhost
```

## Примечания

- Серверы читают эти значения при запуске; перезапустите их после изменения `.env`.
- В Docker адрес привязки принудительно устанавливается в `0.0.0.0`, чтобы контейнер был
  доступен — см. [Развёртывание](/ru/docs/deployment).
- `0.0.0.0` слушает все интерфейсы (используйте внутри контейнеров / в доверенных сетях);
  `localhost` ограничивает доступ локальной машиной.
