# Sharptown × Vue — Example

A small, complete [Vue 3](https://vuejs.org) + [Vite](https://vitejs.dev) single-page
app that drives the Sharptown image transformer through the
[`@sharptown/client`](../../packages/client) SDK.

Pick an image, tweak the operations, hit **Transform**, and watch the result render
live next to the original — together with the exact `@sharptown/client` chain that
produced it.

![layout](https://img.shields.io/badge/stack-Vue%203%20%2B%20Vite-42b883)

---

## What it demonstrates

- Creating a client in the browser: `sharptown('http://localhost:3001')`.
- The **fluent, chainable** builder: `resize`, `rotate`, `flip`, `blur`, `tint`,
  `grayscale`, `removeAlpha`, `ensureAlpha`, `convert`.
- Awaiting the builder to get a `Blob`, then rendering it via `URL.createObjectURL`.
- Typed error handling with `SharptownError` (HTTP status + message).
- Reading the supported output formats straight from `SUPPORTED_FORMATS`.

The whole integration lives in [`src/App.vue`](src/App.vue) — about a screen of code.

---

## Prerequisites

You need the Sharptown **server running**, because the browser app talks to its REST
API. From the repo root:

```bash
pnpm install          # installs all workspaces, including this example
pnpm dev              # starts @sharptown/server on http://localhost:3001
```

> The server enables permissive CORS (`origin: '*'`), so the Vite dev server on a
> different port can call it directly.

---

## Running the example

In a second terminal, from the repo root:

```bash
pnpm --filter @sharptown/example-vue dev
```

Then open the printed URL (default <http://localhost:5173>).

To create a production build / preview it:

```bash
pnpm --filter @sharptown/example-vue build
pnpm --filter @sharptown/example-vue preview
```

---

## How it works

The example depends on the client via the workspace protocol, so it always uses your
local source — no publishing needed:

```jsonc
// examples/vue/package.json
"dependencies": {
  "@sharptown/client": "workspace:*",
  "vue": "^3.5.0"
}
```

The core of the integration is a single function that builds the chain from the
reactive form state and awaits it:

```js
import { sharptown, SharptownError } from '@sharptown/client'

const st = sharptown(baseUrl.value)

const blob = await st
  .transform(file, { filename: file.name })
  .resize({ width, height })
  .blur(blurRadius)
  .grayscale()
  .convert(format)        // awaiting the builder resolves to a Blob

resultUrl.value = URL.createObjectURL(blob)
```

Errors thrown by the server (invalid format, unreadable image, …) arrive as a
`SharptownError`, which the UI renders with its `.status` and `.message`.

---

## Project layout

```
examples/vue/
├─ index.html          # Vite entry
├─ vite.config.js      # Vue plugin + dev server port
├─ package.json        # depends on @sharptown/client (workspace:*)
└─ src/
   ├─ main.js          # mounts the app
   ├─ App.vue          # the whole demo: form + client calls + previews
   └─ style.css        # dark, responsive styling
```

---

## Pointing at another server

Change the **Server URL** field at the top of the app (defaults to
`http://localhost:3001`). It is passed verbatim to `sharptown`, so you can target a
deployed instance or a Docker container started via the root `docker-compose.yml`.
