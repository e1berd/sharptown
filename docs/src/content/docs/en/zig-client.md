---
title: Zig Client
description: A Zig client with REST and JSON-RPC transports, shared operation names, and streaming REST uploads from files.
group: Guide
order: 8
---

# Zig Client

The Zig client mirrors the operation names and REST serialization used by the other
Sharptown clients. It currently supports **REST** (default) and **JSON-RPC** over
WebSocket.

Use REST for large source images. `Input.fromPath` streams the file into the multipart
request without constructing the complete request body in memory. JSON-RPC follows the
current server contract (`params.image` as one base64 string), so it is compatible but not
suitable for multi-gigabyte inputs.

## Install

The Zig client is **not published to a package registry** — it lives in the repository
under `clients/zig`. Add that directory as a dependency in your Zig project, or import
`src/sharptown.zig` directly.

Run its tests from the client directory:

```bash
zig build test
```

## Create a client

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

## Choosing a transport

```zig
// REST (default) — multipart POST to /api/v1/transform
const rest = sharptown.Client.init(allocator, "http://localhost:3001");

// REST with custom endpoint settings
const rest_custom = sharptown.Client
    .init(allocator, "http://localhost:3001")
    .withRestTransport(.{ .path = "/api/v1/transform", .field = "image" });

// JSON-RPC over WebSocket — image.transform at /rpc
const rpc = sharptown.Client
    .init(allocator, "ws://localhost:3002")
    .withJsonRpcTransport(.{ .path = "/rpc", .method = "image.transform" });
```

The Zig JSON-RPC transport currently supports plain `ws://`. `wss://` can be added later
with a TLS WebSocket layer.

## Inputs

```zig
sharptown.Input.fromPath("photo.jpg");                         // streams a file from disk
sharptown.Input.fromBytes(bytes, "upload.png");                // in-memory bytes
sharptown.Input.fromUrl("https://example.com/photo.jpg", null); // fetches over HTTP
```

For very large files, prefer `Input.fromPath` with REST. `Input.fromUrl` currently
downloads the remote file before sending it.

## Operations

Resize and crop: `resize`, `width`, `height`, `crop`, `smartCrop`, `fit`, `background`,
`dpr`, `aspectRatio`, `autoOrient`, `rotate`, `flip`.
Tone and colour: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Filters and effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
Alpha and output: `removeAlpha`, `ensureAlpha`, `convert`, `quality`, `progressive`,
`stripMetadata`, `keepMetadata`.

## Headers

```zig
const headers = [_]sharptown.Header{
    .{ .name = "authorization", .value = "Bearer token" },
};

const client = sharptown.Client
    .init(allocator, "http://localhost:3001")
    .withHeaders(&headers);
```

## Terminals

```zig
const response = try transform.response();
defer response.deinit();

try response.save("out.webp");
```

`Response` contains `status`, optional `content_type`, and owned `body` bytes. Call
`deinit()` when done.

## gRPC

gRPC is not implemented in the Zig client yet. The server protocol already supports
bidirectional chunk streaming; adding it cleanly requires generated protobuf bindings and a
Zig streaming API shape.

See [REST API](/docs/rest-api), [JSON-RPC API](/docs/jsonrpc-api) and
[gRPC API](/docs/grpc-api).
