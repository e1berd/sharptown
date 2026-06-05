# Sharptown Zig Client

Zig client for the Sharptown image transformation API. It mirrors the operation names and
REST serialization used by the JavaScript, Go, PHP, Elixir, Flutter and Rust clients.

The current Zig client ships REST and JSON-RPC transports:

- `POST /api/v1/transform`
- multipart field `image`
- canonical operation query serialization
- local files, raw bytes and HTTP URL inputs
- `ws://.../rpc` JSON-RPC method `image.transform`

```zig
const std = @import("std");
const sharptown = @import("sharptown");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const client = sharptown.Client.init(allocator, "http://localhost:3001");
    var transform = client.transform(sharptown.Input.fromPath("photo.jpg"));

    _ = try transform.resize(800, 600);
    _ = try transform.blur(3);
    _ = transform.grayscale();
    _ = try transform.convert("webp");

    const response = try transform.response();
    defer response.deinit();

    try response.save("out.webp");
}
```

## Use In A Zig Project

This package is not published to a registry. Add `clients/zig` as a dependency from this
repository, or copy `src/sharptown.zig` into your project and import it directly.

Run tests from this directory:

```bash
zig build test
```

## Inputs

```zig
sharptown.Input.fromPath("photo.jpg");
sharptown.Input.fromBytes(bytes, "upload.png");
sharptown.Input.fromUrl("https://example.com/photo.jpg", null);
```

`Input.fromPath` streams the file into the REST multipart request without building the
complete request body in memory, so it is the right input mode for multi-gigabyte atlases.
`Input.fromUrl` currently downloads the remote file before sending it.

## Operations

Resize and crop: `resize`, `width`, `height`, `crop`, `smartCrop`, `fit`, `background`,
`dpr`, `aspectRatio`, `autoOrient`, `rotate`, `flip`.

Tone and color: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.

Filters and effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.

Alpha and output: `removeAlpha`, `ensureAlpha`, `convert`, `quality`, `progressive`,
`stripMetadata`, `keepMetadata`.

## Headers And REST Options

```zig
const headers = [_]sharptown.Header{
    .{ .name = "authorization", .value = "Bearer token" },
};

const client = sharptown.Client
    .init(allocator, "http://localhost:3001")
    .withHeaders(&headers)
    .withRestTransport(.{ .path = "/api/v1/transform", .field = "image" });
```

## Transports

```zig
const rest = sharptown.Client.init(allocator, "http://localhost:3001");

const rpc = sharptown.Client
    .init(allocator, "ws://localhost:3002")
    .withJsonRpcTransport(.{ .path = "/rpc", .method = "image.transform" });
```

JSON-RPC follows the current server contract: the input image is one base64 string in
`params.image`, and the result is one base64 string. That makes it compatible with the
existing server, but it is not appropriate for 3 GB inputs. Use REST for large uploads.

The Zig JSON-RPC transport currently supports plain `ws://`. `wss://` can be added later
with a TLS WebSocket layer.

gRPC is intentionally left for a later pass because it needs generated protobuf bindings
and a streaming API shape; the server protocol already supports bidi chunk streaming.
