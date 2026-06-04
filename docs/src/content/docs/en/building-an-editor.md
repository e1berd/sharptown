---
title: Building a Photo Editor
description: Turn a running server plus the JS client into a full in-browser photo editor.
group: Recipes
order: 1
---

# Building a Photo Editor

Optimized delivery is Sharptown's day job — but a **running server plus the JS client** is
everything you need to build a *complete in-browser photo editor*. The browser handles the
UI and live preview; the server does the real pixel work with Sharp.

This recipe sketches the pieces. The client is JS-only today, so the examples are vanilla
JS / framework-agnostic.

## The idea

```
 user tweaks sliders ──▶ build a transform chain ──▶ POST to Sharptown
        ▲                                                    │
        └────────────  show returned Blob as preview  ◀──────┘
```

Every edit is just a new transform request. Sharptown is stateless, so the editor's
"document" is simply *the original image + the current set of operations*.

## 1. Model the editing state

Keep one object describing the current edits. This is your undo/redo unit, too.

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

## 2. Render a preview on every change

Debounce changes so you do not flood the server while a slider is dragged.

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

## 3. Wire up controls

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
// …and so on for blur, rotate, tint, format
```

## 4. Cancel stale previews

While the user keeps editing, abort the in-flight request so only the latest one wins:

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

## 5. Export the final image

The preview *is* the result — there is no separate "apply" step. Export by downloading
the current blob, or write it to disk in Node/Bun/Deno:

```js
// Browser download
const blob = await st.transform(original).width(state.width).convert(state.format)
const a = document.createElement('a')
a.href = URL.createObjectURL(blob)
a.download = `edited.${state.format}`
a.click()

// Node / Bun / Deno
await st.transform('./original.jpg').width(state.width).convert(state.format)
  .toFile(`./edited.${state.format}`)
```

## Architecture tips

- **Stateless server, stateful client.** Store the operation set in the browser; the
  server just transforms. This makes undo/redo trivial — push/pop operation snapshots.
- **Debounce + abort.** Together they keep previews smooth and the network quiet.
- **Pick the transport for the job.** REST is perfect for editor previews. For very large
  source files, the [gRPC streaming API](/docs/grpc-api) avoids buffering them whole.
- **One original, many derivatives.** Keep the user's upload once; render every variant on
  demand. That is the same principle that makes Sharptown a good delivery optimizer.
