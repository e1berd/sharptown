# @sharptown/client for PHP

Expressive PHP client for the [Sharptown](https://github.com/) image transformation API.
Same chainable API across all three transports — **REST**, **JSON-RPC**, and **gRPC**
(gRPC is in progress) — with no required third-party dependencies.

```php
use function Sharptown\Client\sharptown;

$st = sharptown('http://localhost:3001');

$webp = $st->transform('photo.jpg')
    ->resize(800, 600)
    ->blur(3)
    ->grayscale()
    ->convert('webp')
    ->bytes();
```

## Install

```bash
composer require sharptown/client
```

Requires PHP >= 8.1 with `ext-curl` and `ext-json` (both standard).

## Choosing a transport

The base URL must match the transport you pick.

```php
use function Sharptown\Client\{sharptown, rest, jsonrpc};

// REST (default) — multipart POST to /api/v1/transform
$st = sharptown('http://localhost:3001');

// JSON-RPC over WebSocket — image.transform at /rpc
$st = sharptown('ws://localhost:3002', transport: jsonrpc());
```

All transports accept the same builder, validate operations identically, and return the
same `Response`, so swapping one for another never changes your calling code.

## Inputs

A bare string is treated as an `http(s)` URL or an existing file path. For raw bytes or
streams, use the explicit constructors:

```php
use Sharptown\Client\Input\ImageInput;

$st->transform('photo.jpg');                          // file path
$st->transform('https://example.com/cat.jpg');        // fetched over HTTP
$st->transform(ImageInput::fromString($binary, 'upload.png'));
$st->transform(ImageInput::fromResource($stream, 'in.jpg'));
```

## Getting the result

```php
$bytes = $st->transform($file)->convert('webp')->bytes();        // raw bytes
$st->transform($file)->convert('webp')->toFile('out.webp');      // write to disk

$res = $st->transform($file)->convert('webp')->response();       // full response
echo $res->status(), $res->contentType();
```

## Operations

Resize & crop: `resize`, `width`, `height`, `crop`, `smartCrop`, `fit`, `background`,
`dpr`, `aspectRatio`, `autoOrient`, `rotate`, `flip`.
Tone & colour: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Filters & effects: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
Alpha & output: `removeAlpha`, `ensureAlpha`, `convert`, `quality`, `progressive`,
`stripMetadata`.

Values are validated client-side; an out-of-range value or an unsupported format throws a
`SharptownError` before any request is sent.

## Errors

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

## Worker mode (FrankenPHP, RoadRunner) and PHP-FPM

The client is **stateless and instance-based** — it keeps no global or static request
state — so it behaves the same under classic PHP-FPM and under long-lived workers.

- **Resources are released deterministically.** Each REST call resets a reused cURL handle
  (HTTP keep-alive comes for free in a worker); each JSON-RPC call opens and closes its
  WebSocket in a `finally` block. Nothing leaks across requests.
- **Reuse for speed, or recreate per request — both are safe.** In a worker you can build
  one client at bootstrap and reuse it across iterations to keep connections warm:

  ```php
  // worker.php (FrankenPHP / RoadRunner)
  $st = sharptown('http://localhost:3001');

  $handler = static function () use ($st) {
      return $st->transform($_FILES['image']['tmp_name'])
          ->resize(1024)
          ->convert('webp')
          ->bytes();
  };
  ```

- **One client per worker.** A reused cURL handle is not safe to share across threads;
  give each worker its own client (the usual one-request-at-a-time worker model).
- Need to drop pooled connections between cycles? Inject a `CurlHttpClient` and call
  `close()` on it, or just let the client go out of scope — the handle is closed on
  destruction.

## License

MIT
