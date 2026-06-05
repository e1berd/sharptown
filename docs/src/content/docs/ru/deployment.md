---
title: Развёртывание
description: Поставка Sharptown с Docker, docker compose и обратными прокси nginx / Caddy.
group: Recipes
order: 2
---

# Развёртывание

У каждого сервера есть собственный Dockerfile, собираемый из **корня репозитория** как
контекста (чтобы пакеты рабочего пространства разрешались корректно).

## Сборка одного хоста

```bash
docker build -f packages/server-rest/Dockerfile -t sharptown-rest .
docker run -p 3001:3001 -d sharptown-rest
```

## Запуск через docker compose

`docker-compose.yml` определяет три сервиса: `rest` (3001), `grpc` (50051) и
`jsonrpc` (3002).

```bash
cp .env.example .env   # необязательно; compose работает и без него
```

### Запуск отдельного сервиса

Имя сервиса указывается **после** `up`. Флаги — `-d` (в фоне) и, при первом запуске,
`--build`:

```bash
docker compose up -d rest        # только REST       → :3001
docker compose up -d grpc        # только gRPC       → :50051
docker compose up -d jsonrpc     # только JSON-RPC   → :3002
```

> Обратите внимание на порядок: правильно `docker compose up -d <сервис>`, а не
> `docker compose <сервис> -d`. Используйте `up --build -d <сервис>`, чтобы сначала
> (пере)собрать образ.

### Запуск всех трёх

```bash
docker compose up --build -d     # rest + grpc + jsonrpc
```

### Управление запущенными сервисами

```bash
docker compose ps                # что запущено
docker compose logs -f grpc      # следить за логами одного сервиса
docker compose stop jsonrpc      # остановить один сервис
docker compose down              # остановить и удалить всё
```

Внутри контейнеров адрес привязки принудительно установлен в `0.0.0.0`, чтобы каждый
сервис был доступен, а порты переопределяются теми же переменными `SHARPTOWN_*`:

```yaml
services:
  rest:
    build: { context: ., dockerfile: packages/server-rest/Dockerfile }
    ports: ["${SHARPTOWN_PORT:-3001}:3001"]
    environment: { SHARPTOWN_PORT: 3001, SHARPTOWN_HOST: 0.0.0.0 }
    restart: unless-stopped
  # grpc → 50051, jsonrpc → 3002 имеют такую же форму
```

## Обратный прокси

В продакшене каждый сервис обычно ставят за обратный прокси, который терминирует TLS. У
трёх транспортов **разные требования**: REST — это обычный HTTP (учитывайте размер
загрузки), JSON-RPC требует апгрейда WebSocket, а gRPC требует HTTP/2. Выберите раздел для
того сервиса, который публикуете.

### REST (HTTP, `:3001`)

Загрузки могут быть большими, поэтому поднимите лимит размера тела запроса.

**nginx**

```nginx
server {
  listen 80;
  server_name images.example.com;

  client_max_body_size 100m;   # разрешить большие загрузки изображений

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Caddy** (автоматически получает TLS)

```caddy
images.example.com {
  request_body {
    max_size 100MB
  }
  reverse_proxy 127.0.0.1:3001
}
```

### JSON-RPC (WebSocket, `:3002`)

Эндпоинт — `/rpc`, работает поверх WebSocket, поэтому пробрасывайте заголовки
`Upgrade`/`Connection` и задавайте щедрые таймауты, чтобы простаивающие сокеты не
обрывались.

**nginx**

```nginx
server {
  listen 80;
  server_name rpc.example.com;

  location /rpc {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host       $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

**Caddy** (WebSocket работает «из коробки»)

```caddy
rpc.example.com {
  reverse_proxy 127.0.0.1:3002
}
```

### Один домен с префиксом `/image-process/`

Если основное приложение уже живёт на одном домене, Sharptown можно опубликовать под
отдельным префиксом. В примере ниже:

- `POST /image-process/api/v1/transform` проксируется в REST-контейнер как
  `POST /api/v1/transform`;
- `wss://app.example.com/image-process/rpc` проксируется в JSON-RPC-контейнер как
  WebSocket `/rpc`.

Если nginx или Caddy запущен на хосте, используйте `127.0.0.1:3001` и
`127.0.0.1:3002` при опубликованных compose-портах. Если прокси запущен в той же
docker compose-сети, замените их на имена сервисов: `rest:3001` и `jsonrpc:3002`.

**nginx**

```nginx
# В контексте http {}, рядом с server {}
map $http_upgrade $sharptown_connection_upgrade {
  default upgrade;
  ''      close;
}

server {
  listen 80;
  server_name app.example.com;

  client_max_body_size 100m;

  location = /image-process/rpc {
    proxy_pass http://127.0.0.1:3002/rpc;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection $sharptown_connection_upgrade;
    proxy_set_header Host       $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  location /image-process/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

У `proxy_pass http://127.0.0.1:3001/;` важен завершающий `/`: nginx снимет публичный
префикс `/image-process/` и отправит в REST-сервис путь без него.

**Caddy**

```caddy
app.example.com {
  request_body {
    max_size 100MB
  }

  handle /image-process/rpc {
    rewrite * /rpc
    reverse_proxy 127.0.0.1:3002
  }

  handle_path /image-process/* {
    reverse_proxy 127.0.0.1:3001
  }
}
```

`handle_path` снимает префикс `/image-process/` автоматически, поэтому REST-сервис
получает свой штатный путь `/api/v1/transform`. Для JSON-RPC префикс снимается явным
`rewrite`, а WebSocket-апгрейд Caddy проксирует автоматически.

### gRPC (HTTP/2, `:50051`)

gRPC требует **HTTP/2**. gRPC-сервер Sharptown работает в открытом виде
(`createInsecure`), поэтому прокси говорит с бэкендом по HTTP/2 без шифрования (h2c),
терминируя TLS на стороне клиента.

**nginx** (TLS терминируется здесь; апстрим — `grpc://`, а не `grpcs://`)

```nginx
server {
  listen 443 ssl http2;
  server_name grpc.example.com;

  ssl_certificate     /etc/ssl/grpc.crt;
  ssl_certificate_key /etc/ssl/grpc.key;

  client_max_body_size 0;     # gRPC стримит; фиксированного лимита тела нет
  grpc_read_timeout  3600s;
  grpc_send_timeout  3600s;

  location / {
    grpc_pass grpc://127.0.0.1:50051;
  }
}
```

**Caddy** (`h2c://` = HTTP/2 без шифрования до бэкенда)

```caddy
grpc.example.com {
  reverse_proxy h2c://127.0.0.1:50051
}
```

Направляйте gRPC-клиентов на TLS-эндпоинт прокси (порт `443`) с соответствующими
учётными данными, например `grpc.credentials.createSsl()` вместо `createInsecure()`.

## Продакшен без Docker

У каждого пакета-сервера есть скрипт `prod` (`node <entry>.mjs`) и вариант `prod:env`,
загружающий `.env`:

```bash
pnpm install
pnpm build                                   # сгенерировать декларации типов
pnpm --filter @sharptown/server-rest prod:env
```

## Развёртывание этой документации (статика, без VDS)

Этот сайт документации собран на Astro в режиме **статики (SSG)** по умолчанию, поэтому
`astro build` выдаёт обычные HTML/CSS/JS в `docs/dist/`. Разместите их у любого
статического провайдера — сервер не нужен:

```bash
pnpm --filter @sharptown/docs build   # → docs/dist
```

Загрузите `docs/dist/` на Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront
или любой статический хост / CDN.

> **Заметка про GitHub Pages.** Если вы развёртываете по под-пути
> (например, `https://user.github.io/sharptown/`), задайте `base: '/sharptown/'` в
> `docs/astro.config.mjs`. Все внутренние ссылки этого сайта уже учитывают
> `import.meta.env.BASE_URL`, так что они продолжат работать и по под-пути.

## Эксплуатационные заметки

- Sharptown **без состояния** — масштабируйте горизонтально за балансировщиком, без
  общего состояния для координации.
- Для очень больших входов предпочитайте [gRPC-хост](/ru/docs/grpc-api), чтобы файлы
  передавались потоком, а не буферизировались.
- Учитывайте пиксельные лимиты форматов вывода при конвертации огромных изображений — см.
  [справочник операций](/ru/docs/operations#лимиты-для-больших-файлов-стриминг--grpc).
