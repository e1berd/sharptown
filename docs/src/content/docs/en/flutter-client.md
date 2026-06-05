---
title: Dart / Flutter Client
description: An expressive Dart and Flutter client with REST and JSON-RPC transports and the same fluent API as the other clients.
group: Guide
order: 6
---

# Dart / Flutter Client

The Dart client exposes one fluent API across two transports — REST (default) and
**JSON-RPC** over WebSocket — selected when you create the client. It runs in Flutter
(mobile, desktop) and plain Dart, and uses `async`/`await` throughout.

## Install

The Dart client is **not published to pub.dev** — it lives in the repository under
`clients/flutter`. Add it as a Git dependency pointing at that subdirectory:

```yaml
dependencies:
  sharptown:
    git:
      url: https://github.com/e1berd/sharptown
      path: clients/flutter
```

```dart
import 'package:sharptown/sharptown.dart';
```

It depends only on `http` (REST) and `web_socket_channel` (JSON-RPC). `ImageInput.file`,
`ImageInput.path` and `TransformResponse.save` use `dart:io`; on Flutter Web use
`ImageInput.bytes` / `ImageInput.url` and read `response.bytes`.

## Create a client

```dart
final st = SharptownClient(
  'http://localhost:3001',
  timeout: const Duration(seconds: 15),
  headers: {'authorization': 'Bearer …'},
);
```

Parameters: `transport`, `headers`, `timeout`, `httpClient`. The base URL must match the
chosen transport. The scheme is optional — a bare host like `localhost:3001` defaults to the
secure variant (`https://`, or `wss://` for JSON-RPC); pass `http://` (or `ws://`) explicitly
for a plain connection. Call `st.close()` when done, unless you passed your own `httpClient`.

## Choosing a transport

```dart
// REST (default) — multipart POST to /api/v1/transform
SharptownClient('http://localhost:3001');

// JSON-RPC over WebSocket — image.transform at /rpc
SharptownClient('ws://localhost:3002', transport: const JsonRpcTransport());
```

Both transports accept the same builder and return the same `TransformResponse`, so
swapping one for another never changes your calling code.

## Inputs

```dart
ImageInput.bytes(buffer, 'photo.jpg');          // an in-memory Uint8List
ImageInput.file(File('photo.jpg'));             // a dart:io File
ImageInput.path('photo.jpg');                   // convenience: read from disk
ImageInput.url('https://example.com/cat.jpg');  // convenience: fetch over HTTP
```

A typical Flutter handler, fully in memory:

```dart
Future<Uint8List> thumbnail(Uint8List picked) {
  return st
      .transform(ImageInput.bytes(picked, 'upload.jpg'))
      .width(1024)
      .convert('webp')
      .bytes();
}
```

## Operations

Resize & crop: `resize`, `width`, `height`, `crop`, `smartCrop`, `fit`, `background`,
`dpr`, `aspectRatio`, `autoOrient`, `rotate`, `flip`.
Tone & colour: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Filters & effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
Alpha & output: `removeAlpha`, `ensureAlpha`, `convert`, `quality`, `progressive`,
`stripMetadata`, `keepMetadata`.

Validation happens as you build; the first invalid value (out of range, unsupported
format) throws a `SharptownError` immediately, before any request is sent.

## Terminals

```dart
final res = await t.response();   // TransformResponse (status, headers, bytes)
final data = await t.bytes();     // Uint8List
final file = await t.save('out.webp');
```

## Errors

```dart
try {
  await st.transform(input).convert('webp').bytes();
} on SharptownError catch (e) {
  print('${e.status}: ${e.message}'); // HTTP status / RPC code + message
}
```

## Transports

The same client speaks every Sharptown transport. See [REST API](/docs/rest-api) and
[JSON-RPC API](/docs/jsonrpc-api).
