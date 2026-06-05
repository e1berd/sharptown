# Sharptown

Expressive, **dependency-free** Elixir client for the [Sharptown](https://github.com/)
image transformation API. One pipe-friendly API across all three transports — **REST**,
**JSON-RPC**, and **gRPC** (in progress).

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

## Install

Not published to Hex — it lives in the repository under `clients/elixir`. Add it as a Mix
git dependency pointing at that subdirectory:

```elixir
def deps do
  [{:sharptown, github: "e1berd/sharptown", sparse: "clients/elixir"}]
end
```

No third-party dependencies — REST runs on `:httpc`, JSON-RPC on a built-in WebSocket
client over `:gen_tcp`/`:ssl`, and JSON on the OTP `:json` module. **Requires OTP 27+.**

## Create a client

```elixir
Sharptown.client("http://localhost:3001")
```

Options:

| Option | Default | Purpose |
| ------ | ------- | ------- |
| `:transport` | `Sharptown.rest()` | Pluggable transport. |
| `:headers` | `[]` | Default headers (e.g. `[{"authorization", "Bearer …"}]`). |
| `:timeout` | `30_000` | Request timeout, in milliseconds. |

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

Every transport accepts the same chain, validates operations identically, and returns the
same `Sharptown.Response`, so swapping one for another never changes your pipeline.

## Inputs

A bare string is treated as an `http(s)` URL or an existing file path. For raw bytes or
other sources, use a tuple:

```elixir
Sharptown.transform(client, "photo.jpg")                    # file path
Sharptown.transform(client, "https://example.com/cat.jpg")  # fetched over HTTP
Sharptown.transform(client, {:bytes, data, "upload.png"})   # raw bytes
Sharptown.transform(client, {:file, "photo.jpg"})
Sharptown.transform(client, {:url, "https://…/cat.jpg"})
```

## Operations

Resize & crop: `resize/3`, `width/2`, `height/2`, `crop/5`, `smart_crop/2`, `fit/2`,
`background/2`, `dpr/2`, `aspect_ratio/2`, `auto_orient/2`, `rotate/2`, `flip/2`.
Tone & colour: `brightness/2`, `contrast/2`, `saturation/2`, `exposure/2`, `hue/2`,
`gamma/2`, `colorize/2`, `tint/4`, `grayscale/2`.
Filters & effects: `blur/2`, `sharpen/2`, `sepia/2`, `invert/2`, `threshold/2`,
`oil_paint/2`.
Alpha & output: `remove_alpha/2`, `ensure_alpha/2`, `convert/2`, `quality/2`,
`progressive/2`, `strip_metadata/2`.

Values are validated **before** the request — an out-of-range value or an unsupported
format raises `Sharptown.Error`.

## Running

```elixir
{:ok, %Sharptown.Response{} = res} = transform |> Sharptown.run()
res.status                                # 200
Sharptown.Response.content_type(res)      # "image/webp"
res.body                                  # binary image data

{:ok, bytes} = transform |> Sharptown.bytes()
{:ok, path}  = transform |> Sharptown.to_file("out.webp")

# bang variants raise on error
res   = transform |> Sharptown.run!()
bytes = transform |> Sharptown.bytes!()
```

## Error handling

`run/1`, `bytes/1` and `to_file/2` return `{:error, %Sharptown.Error{}}` for server and
network failures; the `!` variants raise. `Sharptown.Error` carries `:status` (HTTP status
or RPC code) and `:body` (the parsed error payload).

```elixir
case Sharptown.run(transform) do
  {:ok, response} -> response.body
  {:error, %Sharptown.Error{status: status, message: message}} -> {status, message}
end
```

## Custom transport options & headers

```elixir
Sharptown.client(
  "http://localhost:3001",
  transport: Sharptown.rest(field: "image", path: "/api/v1/transform"),
  headers: [{"authorization", "Bearer …"}]
)
```

## License

MIT
