---
title: PHP Client
description: An expressive, chainable PHP client for REST, JSON-RPC and gRPC — one API, no required dependencies.
group: Guide
order: 3
---

# PHP Client

`sharptown/client` is an expressive, chainable PHP client. It exposes **one API across all
three transports** — REST (default), JSON-RPC, and gRPC (in progress) — and needs no
third-party dependencies (just `ext-curl` and `ext-json`). It behaves the same under
classic PHP-FPM and under long-lived workers (FrankenPHP, RoadRunner).

## Install

```bash
composer require sharptown/client
```

Requires PHP >= 8.1.

## Create a client

```php
use function Sharptown\Client\sharptown;

$st = sharptown('http://localhost:3001');
```

`sharptown()` takes the base URL plus named arguments:

| Argument | Type | Default | Purpose |
| -------- | ---- | ------- | ------- |
| `transport` | `Transport` | `rest()` | Pluggable transport. |
| `headers` | `array` | `[]` | Default headers on every request (e.g. auth). |
| `timeout` | `int` | `30` | Request timeout, in seconds. |

The base URL must match the chosen transport.

## Choosing a transport

```php
use function Sharptown\Client\{sharptown, rest, jsonrpc};

// REST (default) — multipart POST to /api/v1/transform
$rest = sharptown('http://localhost:3001');

// JSON-RPC over WebSocket — image.transform at /rpc
$rpc = sharptown('ws://localhost:3002', transport: jsonrpc());
```

Every transport accepts the same builder, validates operations identically, and returns
the same `Response`, so swapping one for another never changes your calling code.

## The transform chain

`$st->transform($input)` returns a chainable **`TransformBuilder`**. Every operation method
returns `$this`, so you compose a pipeline and finish with a terminal.

```php
$bytes = $st->transform($file)
    ->resize(800, 600)
    ->blur(3)
    ->grayscale()
    ->convert('webp')
    ->bytes();
```

### Accepted inputs — no disk required

`transform()` accepts a path/URL string, an `SplFileInfo`, a **stream resource**, a **PSR-7
`StreamInterface`**, or raw bytes — so an image can be edited entirely in memory, without
reading from or writing to disk. (A bare string is an `http(s)` URL or a file path, never
raw bytes — use `ImageInput::fromString()` for those.)

```php
use Sharptown\Client\Input\ImageInput;

$st->transform('photo.jpg');                    // file path (disk)
$st->transform('https://example.com/cat.jpg');  // fetched over HTTP
$st->transform($streamResource);                // any open stream (php://memory, upload…)
$st->transform(ImageInput::fromString($binary, 'upload.png')); // raw bytes
```

#### From S3 / Guzzle, fully in memory

An S3 object body (AWS SDK) or a Guzzle response body is a PSR-7 `StreamInterface` — pass it
straight in; nothing touches disk:

```php
$object = $s3->getObject(['Bucket' => 'bucket', 'Key' => 'photo.jpg']);

$webp = $st->transform($object['Body'])   // PSR-7 stream from S3
    ->resize(width: 1280)
    ->convert('webp')
    ->bytes();                            // result stays in memory too
```

### Operation methods

Resize & crop:

| Method | Description |
| ------ | ----------- |
| `->resize($width, $height = null)` | Resize. Pass `width`/`height` by name too: `->resize(width: 800)`. |
| `->width($n)` / `->height($n)` | Set one dimension. |
| `->crop($left, $top, $width, $height)` | Crop a rectangle. Named args supported: `->crop(left: 10, top: 20, width: 300, height: 200)`. |
| `->smartCrop($enabled = true)` | Crop to the salient region when resizing. |
| `->fit($mode)` | `cover` / `contain` / `fill` / `inside` / `outside`. |
| `->background($color)` | Background for `fit: 'contain'`. |
| `->dpr($value)` | Device pixel ratio; multiplies the target size. |
| `->aspectRatio($ratio)` | Target ratio; combine with `->width()`/`->height()`. |
| `->autoOrient($enabled = true)` | Rotate by EXIF orientation. |
| `->rotate($deg)` | Rotate by degrees. |
| `->flip($enabled = true)` | Flip horizontally. |

Tone, colour & effects:

| Method | Description |
| ------ | ----------- |
| `->brightness($n)` | Brightness `-100`–`100`. |
| `->contrast($n)` | Contrast `-100`–`100`. |
| `->saturation($n)` | Saturation `0`–`2`. |
| `->exposure($n)` | Exposure in EV `-3`–`3`. |
| `->hue($n)` | Hue rotation `0`–`360`. |
| `->gamma($n)` | Gamma `1.0`–`3.0`. |
| `->colorize($color)` | Map to shades of one colour. |
| `->tint($r, $g, $b)` | Tint; each channel optional, pass by name e.g. `->tint(r: 255)`. |
| `->grayscale($enabled = true)` | Desaturate (`->greyscale` is an alias). |
| `->blur($sigma = 1)` | Gaussian blur. |
| `->sharpen($sigma = null)` | Sharpen; no argument uses the default. |
| `->sepia($intensity = 1)` | Sepia `0`–`1`. |
| `->invert($enabled = true)` | Invert colours. |
| `->threshold($n)` | Binarise at `0`–`255`. |
| `->oilPaint($size = 3)` | Oil-paint (median) effect. |

Alpha & output:

| Method | Description |
| ------ | ----------- |
| `->removeAlpha()` / `->ensureAlpha()` | Alpha control. |
| `->quality($n)` | Output quality `1`–`100` (with `->convert()`). |
| `->progressive($enabled = true)` | Progressive output. |
| `->stripMetadata($enabled = true)` | Strip EXIF (default); `false` keeps it. |
| `->convert($format)` | Output format (`->toFormat` is an alias). |

Validation happens **client-side, before the request** — a bad value or an unsupported
format throws a `SharptownError` immediately.

### Terminals

| Terminal | Returns |
| -------- | ------- |
| `->response()` | `Response` (status, headers, bytes) |
| `->bytes()` | raw image bytes (`string`) — stays in memory |
| `->toStream($stream)` | writes to a stream resource (no disk), returns bytes written |
| `->toFile($path)` / `->save($path)` | writes to disk, returns the path |

```php
$res = $st->transform($file)->convert('webp')->response();
echo $res->status(), $res->contentType();   // 200 image/webp

$st->transform('in.jpg')->resize(1024)->convert('avif')->toFile('out.avif');
```

## Shortcuts

```php
$png   = $st->convert($file, 'png')->bytes();
$small = $st->resize($file, 320, 240)->bytes();
```

## Error handling

```php
use Sharptown\Client\SharptownError;

try {
    $st->transform($file)->convert('webp')->bytes();
} catch (SharptownError $e) {
    echo $e->getMessage();   // server or validation message
    echo $e->status;         // HTTP status / RPC code, when from the server
    var_dump($e->body);      // parsed error body, when present
}
```

## Custom transport & headers

```php
use function Sharptown\Client\{sharptown, rest};

$st = sharptown(
    'http://localhost:3001',
    transport: rest(field: 'image', path: '/api/v1/transform'),
    headers: ['authorization' => 'Bearer …'],
);
```

## Worker mode (FrankenPHP, RoadRunner) and PHP-FPM

The client is **stateless and instance-based**, so it behaves identically under PHP-FPM and
under long-lived workers:

- **Resources are released deterministically.** The REST transport reuses a cURL handle, so
  HTTP keep-alive comes for free in a worker; the JSON-RPC transport opens and closes its
  WebSocket in a `finally` block. Nothing leaks across requests.
- **Reuse for speed, or recreate per request — both are safe.** In a worker, build the
  client once at bootstrap and reuse it to keep connections warm:

  ```php
  // worker bootstrap
  $st = sharptown('http://localhost:3001');

  // per request
  return $st->transform($_FILES['image']['tmp_name'])->resize(1024)->convert('webp')->bytes();
  ```

- **One client per worker** — a reused cURL handle is not safe to share across threads.

## Transports

The same client speaks every Sharptown transport. See:

- [REST API](/docs/rest-api)
- [JSON-RPC API](/docs/jsonrpc-api)
- [gRPC API](/docs/grpc-api)
