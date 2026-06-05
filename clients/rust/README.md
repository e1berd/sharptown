# sharptown-client for Rust

Rust client for the Sharptown image transformation API. It mirrors the operation builder
used by the JavaScript, Go, PHP, Elixir and Flutter clients.

The current Rust client ships REST and JSON-RPC transports:

- `POST /api/v1/transform`
- multipart field `image`
- canonical operation query serialization
- local files, raw bytes and HTTP URL inputs
- `ws(s)://.../rpc` JSON-RPC method `image.transform`

```rust
use sharptown::{Client, Input};

let st = Client::new("http://localhost:3001");

let webp = st
    .transform(Input::path("photo.jpg"))
    .resize(800, 600)
    .blur(3)
    .grayscale()
    .convert("webp")
    .bytes()?;
# Ok::<(), sharptown::SharptownError>(())
```

## Install

This crate is not published to crates.io. Use it as a path dependency from this repository:

```toml
[dependencies]
sharptown-client = { path = "path/to/sharptown/clients/rust" }
```

The library crate name is `sharptown`:

```rust
use sharptown::{Client, Input};
```

## Inputs

```rust
Input::path("photo.jpg");
Input::bytes(bytes, "upload.png");
Input::url("https://example.com/photo.jpg");
Input::reader(file_or_stream, "atlas.tiff");
```

`Input::path`, `Input::reader` and `Input::url` stream into the REST multipart request.
They do not read the source image into a `Vec<u8>` first, so REST is the right transport
for very large inputs such as multi-gigabyte atlases.

## Operations

Resize and crop: `resize`, `width`, `height`, `crop`, `smart_crop`, `fit`,
`background`, `dpr`, `aspect_ratio`, `auto_orient`, `rotate`, `flip`.

Tone and color: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.

Filters and effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oil_paint`.

Alpha and output: `remove_alpha`, `ensure_alpha`, `convert`, `quality`, `progressive`,
`strip_metadata`, `keep_metadata`.

Values are validated before the request. Like the Go client, the first invalid operation
is stored on the builder and returned by the terminal call.

## Custom REST settings and headers

```rust
use sharptown::{Client, RestTransport};

let st = Client::new("http://localhost:3001")
    .with_header("authorization", "Bearer token")
    .with_rest_transport(RestTransport::new().with_path("/api/v1/transform"));
```

## Choosing A Transport

```rust
use sharptown::{Client, Transport};

// REST, default. Streams request bodies.
let rest = Client::new("http://localhost:3001");

// JSON-RPC over WebSocket.
let rpc = Client::new("ws://localhost:3002").with_transport(Transport::jsonrpc());
```

JSON-RPC follows the current server contract: `params.image` is one base64 string and the
response image is returned as one base64 string. That means JSON-RPC is compatible, but it
is not the right protocol for 3 GB inputs. Use REST now, and gRPC when bidi streaming is
added to this client.

## Terminals

```rust
let response = st.transform(Input::path("photo.jpg")).convert("webp").response()?;
let bytes = st.transform(Input::path("photo.jpg")).convert("webp").bytes()?;
st.transform(Input::path("photo.jpg")).convert("webp").save("out.webp")?;
```

`Response` contains `status`, `headers` and `body`, plus `content_type()` and `save()`.

## Transports

REST and JSON-RPC are implemented. gRPC is intentionally left for a later pass because it
needs generated protobuf bindings and a streaming API shape; the server protocol already
supports bidi chunk streaming.

## Signed image proxy

Build a signed URL for the server's `GET /fetch` endpoint, suitable for an `<img>` tag: the
server downloads, transforms, and caches the remote image. Configure the shared secret with
`with_proxy_secret` (the server's `SHARPTOWN_PROXY_KEY`).

```rust
let client = Client::new("https://img.example.com").with_proxy_secret(secret);
let mut ops = Operations::new();
ops.insert("width".into(), OperationValue::Int(800));
ops.insert("convertTo".into(), OperationValue::String("webp".into()));
let src = client.signed_url("https://example.com/photo.jpg", &ops)?;
```
