---
title: Elixir Client
description: A dependency-free, pipe-friendly Elixir client for the REST and JSON-RPC transports.
group: Guide
order: 5
---

# Elixir Client

The Elixir client is **dependency-free** and pipe-friendly. It speaks the **REST** (default)
and **JSON-RPC** transports today (gRPC is in progress), with one chainable API.

## Install

The Elixir client is **not published to Hex** — it lives in the repository under
`clients/elixir`. Add it as a Mix git dependency pointing at that subdirectory:

```elixir
def deps do
  [{:sharptown, github: "e1berd/sharptown", sparse: "clients/elixir"}]
end
```

No third-party dependencies — REST runs on `:httpc`, JSON-RPC on a built-in WebSocket client
over `:gen_tcp`/`:ssl`, and JSON on the OTP `:json` module. **Requires OTP 27+.**

## Create a client

```elixir
Sharptown.client("http://localhost:3001")
```

Options: `:transport` (defaults to `Sharptown.rest()`), `:headers`, `:timeout` (ms).
The base URL must match the chosen transport. The scheme is optional — a bare host like
`localhost:3001` defaults to the secure variant (`https://`, or `wss://` for JSON-RPC); pass
`http://` (or `ws://`) explicitly for a plain connection.

## Choosing a transport

```elixir
# REST (default) — multipart POST to /api/v1/transform
Sharptown.client("http://localhost:3001")

# JSON-RPC over WebSocket — image.transform at /rpc
Sharptown.client("ws://localhost:3002", transport: Sharptown.jsonrpc())
```

## The transform chain

```elixir
{:ok, response} =
  Sharptown.client("http://localhost:3001")
  |> Sharptown.transform("photo.jpg")
  |> Sharptown.resize(800, 600)
  |> Sharptown.blur(3)
  |> Sharptown.grayscale()
  |> Sharptown.convert(:webp)
  |> Sharptown.run()
```

### Inputs

A bare string is an `http(s)` URL or an existing file path. For raw bytes or other sources,
use a tuple:

```elixir
Sharptown.transform(client, "photo.jpg")                    # file path
Sharptown.transform(client, "https://example.com/cat.jpg")  # fetched over HTTP
Sharptown.transform(client, {:bytes, data, "upload.png"})   # raw bytes, no disk
Sharptown.transform(client, {:file, "photo.jpg"})
Sharptown.transform(client, {:url, "https://…/cat.jpg"})
```

### Operations

Resize & crop: `resize/3`, `width/2`, `height/2`, `crop/5`, `smart_crop/2`, `fit/2`,
`background/2`, `dpr/2`, `aspect_ratio/2`, `auto_orient/2`, `rotate/2`, `flip/2`.
Tone & colour: `brightness/2`, `contrast/2`, `saturation/2`, `exposure/2`, `hue/2`,
`gamma/2`, `colorize/2`, `tint/4`, `grayscale/2`.
Filters & effects: `blur/2`, `sharpen/2`, `sepia/2`, `invert/2`, `threshold/2`,
`oil_paint/2`.
Alpha & output: `remove_alpha/2`, `ensure_alpha/2`, `convert/2`, `quality/2`,
`progressive/2`, `strip_metadata/2`.

Values are validated before the request; an out-of-range value or unsupported format raises
`Sharptown.Error`.

### Running

```elixir
{:ok, %Sharptown.Response{} = res} = Sharptown.run(transform)
res.status                              # 200
Sharptown.Response.content_type(res)    # "image/webp"
res.body                                # binary image data

{:ok, bytes} = Sharptown.bytes(transform)
{:ok, path}  = Sharptown.to_file(transform, "out.webp")

# bang variants raise on error
res = Sharptown.run!(transform)
```

## Error handling

`run/1`, `bytes/1` and `to_file/2` return `{:error, %Sharptown.Error{}}` for server and
network failures; the `!` variants raise. `Sharptown.Error` carries `:status` (HTTP status
or RPC code) and `:body`.

```elixir
case Sharptown.run(transform) do
  {:ok, response} -> response.body
  {:error, %Sharptown.Error{status: status, message: message}} -> {status, message}
end
```

## Signed image proxy

Build a signed URL for the server's [`GET /fetch`](/docs/image-proxy) endpoint, suitable for
an `<img src>`: the server downloads, transforms, and caches the remote image. Pass
`:proxy_secret` (the server's `SHARPTOWN_PROXY_KEY`).

```elixir
"https://img.example.com"
|> Sharptown.client(proxy_secret: System.fetch_env!("SHARPTOWN_PROXY_KEY"))
|> Sharptown.signed_url("https://example.com/photo.jpg", %{"width" => 800, "convertTo" => "webp"})
```

## Transports

The same client speaks every Sharptown transport. See [REST API](/docs/rest-api) and
[JSON-RPC API](/docs/jsonrpc-api). gRPC support is in progress.
