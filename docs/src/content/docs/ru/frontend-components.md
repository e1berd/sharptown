---
title: Фронтенд-компоненты
description: Компоненты ImageDelivery из одного <img> для Vue, React, Svelte и Astro.
group: Guide
order: 1.5
---

# Фронтенд-компоненты

Поверх [`@sharptown/client`](/ru/docs/js-client) Sharptown поставляет тонкие обёртки для
фреймворков — чтобы вставлять трансформированные изображения прямо в UI:

| Пакет | Фреймворк |
| ----- | --------- |
| `@sharptown/vue` | Vue 3 |
| `@sharptown/react` | React 18+ |
| `@sharptown/svelte` | Svelte 5 |
| `@sharptown/astro` | Astro 4+ |

Идея у всех одна: компонент **`ImageDelivery`** из единственного `<img>` плюс способ
прокинуть один клиент через дерево компонентов. Компонент рендерит ровно один корневой
`<img>`, поэтому любой нативный атрибут и событие — `alt`, `class`, `loading`, `decoding`,
`sizes`, `srcset`, `load`, `error` — пробрасываются на него без изменений. Пропсы
трансформации (`width`, `height`, `blur`, `aspectRatio` и любой другой ключ
[`Operations`](/ru/docs/operations)) превращаются в **подписанный**
[URL прокси-изображения](/ru/docs/image-proxy) через `client.signedUrl(...)`.

## Безопасность: где хранить секрет

Для подписи нужен серверный ключ `SHARPTOWN_PROXY_KEY`. Создавайте клиент с `proxySecret`
**только там, где секрет остаётся на сервере** — SSR/SSG-рендер, страница Astro, серверный
компонент Nuxt/Next. В чистом клиентском SPA секрет попал бы в бандл; это компромисс на ваше
усмотрение.

## Vue

Один раз предоставьте клиент в родителе, затем используйте `ImageDelivery` где угодно ниже.

```vue
<!-- Родитель -->
<script setup lang="ts">
import { sharptown } from '@sharptown/client'
import { provideSharptownClient } from '@sharptown/vue'

provideSharptownClient(sharptown('https://img.example.com', { proxySecret: SHARPTOWN_PROXY_KEY }))
</script>
```

```vue
<!-- Потомок -->
<script setup lang="ts">
import { ImageDelivery } from '@sharptown/vue'
</script>

<template>
  <ImageDelivery
    src="https://example.com/photo.png"
    :width="100"
    :height="100"
    :blur="1"
    :aspect-ratio="16 / 9"
    alt="A blurred photo"
    @load="onLoad"
    @error="onError"
  />
</template>
```

- `provideSharptownClient(client)` — предоставить клиент потомкам (вызвать в `setup` родителя).
- `useSharptownClient()` — прочитать предоставленный клиент (бросает, если его нет).

## React

```tsx
import { sharptown } from '@sharptown/client'
import { SharptownProvider, ImageDelivery } from '@sharptown/react'

const client = sharptown('https://img.example.com', { proxySecret: process.env.SHARPTOWN_PROXY_KEY })

export function App() {
  return (
    <SharptownProvider client={client}>
      <ImageDelivery
        src="https://example.com/photo.png"
        width={100}
        height={100}
        blur={1}
        aspectRatio={16 / 9}
        alt="A blurred photo"
        onLoad={() => {}}
        onError={() => {}}
      />
    </SharptownProvider>
  )
}
```

- `SharptownProvider` — провайдер контекста; клиент передаётся пропом `client`.
- `useSharptownClient()` — прочитать предоставленный клиент.

## Svelte

```svelte
<!-- Родитель -->
<script>
  import { sharptown } from '@sharptown/client'
  import { setSharptownClient } from '@sharptown/svelte'

  setSharptownClient(sharptown('https://img.example.com', { proxySecret: SHARPTOWN_PROXY_KEY }))
</script>

<slot />
```

```svelte
<!-- Потомок -->
<script>
  import { ImageDelivery } from '@sharptown/svelte'
</script>

<ImageDelivery
  src="https://example.com/photo.png"
  width={100}
  height={100}
  blur={1}
  aspectRatio={16 / 9}
  alt="A blurred photo"
  onload={() => {}}
  onerror={() => {}}
/>
```

- `setSharptownClient(client)` / `getSharptownClient()` — общий клиент через контекст Svelte.

## Astro

Astro рендерит на сервере, поэтому URL подписывается во время рендера, а секрет не попадает в
браузер. Зарегистрируйте клиент один раз и импортируйте компонент по пути.

```ts
// src/sharptown.ts
import { sharptown } from '@sharptown/client'
import { setSharptownClient } from '@sharptown/astro'

setSharptownClient(sharptown('https://img.example.com', { proxySecret: import.meta.env.SHARPTOWN_PROXY_KEY }))
```

```astro
---
import '../sharptown.ts'
import ImageDelivery from '@sharptown/astro/ImageDelivery.astro'
---

<ImageDelivery
  src="https://example.com/photo.png"
  width={100}
  height={100}
  blur={1}
  aspectRatio={16 / 9}
  alt="A blurred photo"
/>
```

- `setSharptownClient(client)` / `getSharptownClient()` — зарегистрировать/прочитать клиент (singleton модуля).
