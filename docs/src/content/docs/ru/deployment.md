---
title: Развёртывание
description: Поставка Sharptown с Docker и docker-compose.
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

## docker-compose — все три транспорта

`docker-compose.yml` определяет три сервиса: `rest` (3001), `grpc` (50051) и
`jsonrpc` (3002).

```bash
cp .env.example .env            # необязательно; compose работает и без него
docker compose up --build rest  # только REST
docker compose up --build       # все три
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
