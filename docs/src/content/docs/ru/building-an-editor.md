---
title: Как построить фоторедактор
description: Превратите запущенный сервер и JS-клиент в полноценный фоторедактор в браузере.
group: Recipes
order: 1
---

# Как построить фоторедактор

Оптимизированная доставка — повседневная работа Sharptown, но **запущенный сервер плюс
JS-клиент** — это всё, что нужно, чтобы построить *полноценный фоторедактор в браузере*.
Браузер отвечает за интерфейс и живое превью; сервер делает настоящую работу с пикселями с
помощью Sharp.

Этот рецепт намечает основные части. Клиент сегодня только на JS, поэтому примеры —
обычный JS, не зависящий от фреймворка.

## Идея

```mermaid
flowchart LR
  ui["Пользователь крутит слайдеры"] --> chain["Собираем цепочку трансформаций"]
  chain --> post["POST на Sharptown"]
  post --> preview["Показываем вернувшийся Blob как превью"]
  preview --> ui
```

Каждое редактирование — это просто новый запрос трансформации. Sharptown без состояния,
поэтому «документ» редактора — это всего лишь *исходное изображение + текущий набор
операций*.

## 1. Смоделируйте состояние редактирования

Держите один объект, описывающий текущие правки. Это же — единица отмены/повтора.

```js
const state = {
  width: null,
  blur: 0,
  rotate: 0,
  grayscale: false,
  tint: { r: null, g: null, b: null },
  format: 'webp',
}
```

## 2. Рендерите превью на каждое изменение

Дебаунсите изменения, чтобы не заваливать сервер запросами, пока тянут слайдер.

```js
import { sharptown } from '@sharptown/client'

const st = sharptown('http://localhost:3001')
let previewUrl

const renderPreview = debounce(async (original) => {
  const builder = st.transform(original).convert(state.format)

  if (state.width) builder.width(state.width)
  if (state.blur) builder.blur(state.blur)
  if (state.rotate) builder.rotate(state.rotate)
  if (state.grayscale) builder.grayscale()
  if (state.tint.r != null || state.tint.g != null || state.tint.b != null) {
    builder.tint(state.tint)
  }

  const blob = await builder.blob()
  if (previewUrl) URL.revokeObjectURL(previewUrl)
  previewUrl = URL.createObjectURL(blob)
  document.querySelector('#preview').src = previewUrl
}, 200)

function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}
```

## 3. Подключите элементы управления

```js
const original = fileInput.files[0]

widthSlider.addEventListener('input', (e) => {
  state.width = Number(e.target.value)
  renderPreview(original)
})

grayscaleToggle.addEventListener('change', (e) => {
  state.grayscale = e.target.checked
  renderPreview(original)
})
// …и так далее для blur, rotate, tint, format
```

## 4. Отменяйте устаревшие превью

Пока пользователь продолжает редактировать, прерывайте текущий запрос, чтобы побеждал
только последний:

```js
let controller
async function preview(original) {
  controller?.abort()
  controller = new AbortController()
  try {
    const blob = await st.transform(original)
      .width(state.width).blur(state.blur).convert(state.format)
      .abortWith(controller.signal)
    showPreview(blob)
  } catch (error) {
    if (error.name !== 'AbortError') throw error
  }
}
```

## 5. Экспортируйте итоговое изображение

Превью *и есть* результат — отдельного шага «применить» нет. Экспортируйте, скачав текущий
blob, или запишите его на диск в Node/Bun/Deno:

```js
// Скачивание в браузере
const blob = await st.transform(original).width(state.width).convert(state.format)
const a = document.createElement('a')
a.href = URL.createObjectURL(blob)
a.download = `edited.${state.format}`
a.click()

// Node / Bun / Deno
await st.transform('./original.jpg').width(state.width).convert(state.format)
  .toFile(`./edited.${state.format}`)
```

## Советы по архитектуре

- **Сервер без состояния, состояние в клиенте.** Храните набор операций в браузере; сервер
  лишь трансформирует. Это делает отмену/повтор тривиальными — кладите/снимайте снимки
  операций.
- **Дебаунс + отмена.** Вместе они держат превью плавным, а сеть — тихой.
- **Выбирайте транспорт под задачу.** REST идеален для превью в редакторе. Для очень
  больших исходников [gRPC streaming API](/ru/docs/grpc-api) избегает буферизации файла
  целиком.
- **Один оригинал, много производных.** Храните загрузку пользователя однажды; порождайте
  каждый вариант по запросу. Тот же принцип делает Sharptown хорошим оптимизатором доставки.
