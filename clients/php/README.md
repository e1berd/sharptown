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

Not published to Packagist — it lives in the repository under `clients/php`. Clone the repo
and add a Composer path repository:

```json
{
    "repositories": [
        { "type": "path", "url": "path/to/sharptown/clients/php" }
    ],
    "require": {
        "sharptown/client": "*"
    }
}
```

It has no runtime dependencies beyond `ext-curl` and `ext-json`, so you can also just copy
`src/` into your project and autoload the `Sharptown\Client` namespace (PSR-4).

Requires PHP >= 8.1.

## Choosing a transport

The base URL must match the transport you pick. The scheme is optional — a bare host like
`localhost:3001` defaults to the secure variant (`https://`, or `wss://` for JSON-RPC); pass
`http://` (or `ws://`) explicitly for a plain connection.

```php
use function Sharptown\Client\{sharptown, rest, jsonrpc};

// REST (default) — multipart POST to /api/v1/transform
$st = sharptown('http://localhost:3001');

// JSON-RPC over WebSocket — image.transform at /rpc
$st = sharptown('ws://localhost:3002', transport: jsonrpc());
```

All transports accept the same builder, validate operations identically, and return the
same `Response`, so swapping one for another never changes your calling code.

## Inputs — no disk required

`transform()` accepts a path/URL string, an `SplFileInfo`, a stream resource, a PSR-7
`StreamInterface`, or raw bytes — so an image can be edited entirely in memory.

```php
use Sharptown\Client\Input\ImageInput;

$st->transform('photo.jpg');                    // file path (disk)
$st->transform('https://example.com/cat.jpg');  // fetched over HTTP
$st->transform($streamResource);                // any open stream (php://memory, upload…)
$st->transform(ImageInput::fromString($binary, 'upload.png')); // raw bytes
```

From S3 / Guzzle, never touching disk — an object/response body is a PSR-7 stream:

```php
$object = $s3->getObject(['Bucket' => 'bucket', 'Key' => 'photo.jpg']);
$webp = $st->transform($object['Body'])->resize(width: 1280)->convert('webp')->bytes();
```

## Getting the result

```php
$bytes = $st->transform($file)->convert('webp')->bytes();        // raw bytes (in memory)
$st->transform($file)->convert('webp')->toStream($stream);       // write to a stream (no disk)
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

## Signed image proxy

Build a signed URL for the server's `GET /fetch` endpoint, suitable for an `<img src>`: the
server downloads, transforms, and caches the remote image. Pass the shared `proxySecret`
(the server's `SHARPTOWN_PROXY_KEY`); sign on a trusted server only.

```php
$st = sharptown('https://img.example.com', proxySecret: getenv('SHARPTOWN_PROXY_KEY'));
$src = $st->signedUrl('https://example.com/photo.jpg', ['width' => 800, 'convertTo' => 'webp']);
```

## License

MIT
