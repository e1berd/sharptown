---
title: Go Client
description: An expressive Go client with all three transports — REST, JSON-RPC and gRPC — streaming straight from any io.Reader.
group: Guide
order: 4
---

# Go Client

The Go client exposes one fluent API across **all three transports** — REST (default),
JSON-RPC, and **gRPC** — selected when you create the client. Images stream straight from
any `io.Reader` (an `*os.File`, a multipart upload, an in-memory buffer), so a photo can be
transformed **entirely in memory, without ever touching disk**.

## Install

The Go client is **not published to a package registry** — it lives in the repository under
`clients/go`. Go fetches it straight from GitHub:

```bash
go get github.com/e1berd/sharptown/clients/go
```

```go
import sharptown "github.com/e1berd/sharptown/clients/go"
```

It uses the standard library for REST plus `coder/websocket` (JSON-RPC) and `grpc-go`
(gRPC); the gRPC stubs are committed, so no codegen is needed to build.

## Create a client

```go
c := sharptown.New("http://localhost:3001",
    sharptown.WithTimeout(15*time.Second),
    sharptown.WithHeader("authorization", "Bearer …"),
)
```

Options: `WithTransport`, `WithHeaders`, `WithHeader`, `WithTimeout`, `WithHTTPClient`. The
base URL must match the chosen transport. The scheme is optional — a bare host like
`localhost:3001` defaults to the secure variant (`https://`, or `wss://` for JSON-RPC); pass
`http://` (or `ws://`) explicitly for a plain connection.

## Choosing a transport

```go
// REST (default) — multipart POST to /api/v1/transform
sharptown.New("http://localhost:3001")

// JSON-RPC over WebSocket — image.transform at /rpc
sharptown.New("ws://localhost:3002", sharptown.WithTransport(sharptown.JSONRPC()))

// gRPC — sharptown.v1.ImageProcessor/Transform (bidi streaming)
sharptown.New("localhost:50051", sharptown.WithTransport(sharptown.GRPC()))
```

Every transport accepts the same builder and returns the same `*Response`, so swapping one
for another never changes your calling code.

## Inputs — no disk required

```go
sharptown.File(f)                  // a standard *os.File (name taken from the file)
sharptown.Reader(r, "photo.jpg")   // any io.Reader: multipart.File, bytes.Buffer, net stream…
sharptown.Bytes(buf, "photo.jpg")  // an in-memory []byte
sharptown.Path("photo.jpg")        // convenience: read from disk
sharptown.URL("https://…/cat.jpg") // convenience: fetch over HTTP
```

A typical HTTP handler, fully in memory:

```go
func handler(w http.ResponseWriter, r *http.Request) {
    file, hdr, _ := r.FormFile("image")
    defer file.Close()

    data, err := c.Transform(sharptown.Reader(file, hdr.Filename)).
        Width(1024).Convert("webp").Bytes(r.Context())
    // …
}
```

## Operations

Resize & crop: `Resize`, `Width`, `Height`, `Crop`, `SmartCrop`, `Fit`, `Background`,
`DPR`, `AspectRatio`, `AutoOrient`, `Rotate`, `Flip`.
Tone & colour: `Brightness`, `Contrast`, `Saturation`, `Exposure`, `Hue`, `Gamma`,
`Colorize`, `Tint`, `Grayscale`.
Filters & effects: `Blur`, `Sharpen`, `Sepia`, `Invert`, `Threshold`, `OilPaint`.
Alpha & output: `RemoveAlpha`, `EnsureAlpha`, `Convert`, `Quality`, `Progressive`,
`StripMetadata`, `KeepMetadata`.

The first invalid value (out of range, unsupported format) is captured and returned by the
terminal — or check `Err()` early.

## Terminals

```go
res, err := t.Do(ctx)        // *Response (Status, Header, Body)
data, err := t.Bytes(ctx)    // []byte, stays in memory
err := t.Save(ctx, "out.webp")
```

## Errors

```go
var se *sharptown.Error
if errors.As(err, &se) {
    log.Println(se.Status, se.Message) // HTTP status / RPC code + message
}
```

## Transports

The same client speaks every Sharptown transport. See [REST API](/docs/rest-api),
[JSON-RPC API](/docs/jsonrpc-api) and [gRPC API](/docs/grpc-api).
