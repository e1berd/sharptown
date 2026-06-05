---
title: Rust Client
description: A Rust client with REST and JSON-RPC transports, the shared fluent operation builder, and streaming REST uploads for large images.
group: Guide
order: 7
---

# Rust Client

The Rust client exposes the same fluent operation builder as the other Sharptown clients.
It currently supports **REST** (default) and **JSON-RPC** over WebSocket.

REST is the transport to use for large source images. `Input::path`, `Input::reader` and
`Input::url` are streamed into the multipart request, so the client does not read a
multi-gigabyte atlas into a `Vec<u8>` before upload. JSON-RPC follows the current server
contract (`params.image` as one base64 string), so it is compatible but not appropriate for
multi-gigabyte inputs.

## Install

The Rust client is **not published to crates.io** — it lives in the repository under
`clients/rust`. Add it as a path dependency:

```toml
[dependencies]
sharptown-client = { path = "path/to/sharptown/clients/rust" }
```

The package name is `sharptown-client`; the library crate name is `sharptown`:

```rust
use sharptown::{Client, Input};
```

## Create a client

```rust
use sharptown::{Client, Input};

let st = Client::new("http://localhost:3001")
    .with_header("authorization", "Bearer token");

let webp = st
    .transform(Input::path("photo.jpg"))
    .resize(800, 600)
    .blur(3)
    .grayscale()
    .convert("webp")
    .bytes()?;
# Ok::<(), sharptown::SharptownError>(())
```

## Choosing a transport

```rust
use sharptown::{Client, JsonRpcTransport, RestTransport, Transport};

// REST (default) — multipart POST to /api/v1/transform
let rest = Client::new("http://localhost:3001");

// REST with custom endpoint settings
let rest_custom = Client::new("http://localhost:3001")
    .with_rest_transport(RestTransport::new().with_path("/api/v1/transform"));

// JSON-RPC over WebSocket — image.transform at /rpc
let rpc = Client::new("ws://localhost:3002")
    .with_transport(Transport::jsonrpc());

// JSON-RPC with custom endpoint settings
let rpc_custom = Client::new("ws://localhost:3002")
    .with_jsonrpc_transport(JsonRpcTransport::new().with_method("image.transform"));
```

The base URL must match the chosen transport. A missing scheme defaults to the secure
variant, as in the other clients: `localhost:3001` becomes `https://localhost:3001`.

## Inputs

```rust
Input::path("photo.jpg");                         // streams a file from disk
Input::reader(file_or_stream, "atlas.tiff");      // streams any Read + Send source
Input::bytes(bytes, "upload.png");                // in-memory bytes
Input::url("https://example.com/photo.jpg");      // fetches over HTTP, then streams REST
```

For very large files, prefer `Input::path` or `Input::reader` with REST. The response is
returned as `Vec<u8>` by `response()` / `bytes()`, matching the other clients.

## Operations

Resize and crop: `resize`, `width`, `height`, `crop`, `smart_crop`, `fit`, `background`,
`dpr`, `aspect_ratio`, `auto_orient`, `rotate`, `flip`.
Tone and colour: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Filters and effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oil_paint`.
Alpha and output: `remove_alpha`, `ensure_alpha`, `convert`, `quality`, `progressive`,
`strip_metadata`, `keep_metadata`.

Like the Go client, the first invalid operation is stored on the builder and returned by
the terminal call. You can inspect it early with `err()`.

## Terminals

```rust
let response = st.transform(Input::path("photo.jpg")).convert("webp").response()?;
let bytes = st.transform(Input::path("photo.jpg")).convert("webp").bytes()?;
st.transform(Input::path("photo.jpg")).convert("webp").save("out.webp")?;
```

`Response` contains `status`, `headers` and `body`, plus `content_type()` and `save()`.

## Errors

```rust
match st.transform(Input::path("photo.jpg")).convert("webp").bytes() {
    Ok(bytes) => println!("{} bytes", bytes.len()),
    Err(err) => eprintln!("{:?}: {}", err.status, err.message),
}
```

## Signed image proxy

Build a signed URL for the server's [`GET /fetch`](/docs/image-proxy) endpoint, suitable for
an `<img>` tag: the server downloads, transforms, and caches the remote image. Configure the
shared secret with `with_proxy_secret` (the server's `SHARPTOWN_PROXY_KEY`).

```rust
let client = Client::new("https://img.example.com").with_proxy_secret(secret);

let mut ops = Operations::new();
ops.insert("width".into(), OperationValue::Int(800));
ops.insert("convertTo".into(), OperationValue::String("webp".into()));

let src = client.signed_url("https://example.com/photo.jpg", &ops)?;
```

## gRPC

gRPC is not implemented in the Rust client yet. The server protocol already supports
bidirectional chunk streaming, and the Rust client keeps the shared operation model ready
for that future transport.

See [REST API](/docs/rest-api), [JSON-RPC API](/docs/jsonrpc-api) and
[gRPC API](/docs/grpc-api).
