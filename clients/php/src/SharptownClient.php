<?php

declare(strict_types=1);

namespace Sharptown\Client;

use SplFileInfo;
use Sharptown\Client\Input\ImageInput;
use Sharptown\Client\Transport\RestTransport;
use Sharptown\Client\Transport\Transport;

/**
 * The Sharptown client. Create one via {@link sharptown()}.
 *
 * The base URL points at the host for the chosen transport: REST (`…:3001`), JSON-RPC
 * WebSocket (`…:3002`), or gRPC (`…:50051`). The scheme is optional and defaults to the
 * secure variant — `localhost:3001` becomes `https://localhost:3001`; pass `http://`
 * explicitly for plain HTTP.
 *
 * @example
 * use function Sharptown\Client\sharptown;
 *
 * $st = sharptown('http://localhost:3001');
 * $webp = $st->transform('photo.jpg')->resize(800)->convert('webp')->bytes();
 */
final class SharptownClient
{
    private string $baseUrl;
    private Transport $transport;
    /** @var array<string, string> */
    private array $headers;
    private int $timeout;
    private ?string $proxySecret;
    private string $proxyPath;

    /**
     * @param array<string, string> $headers Default headers sent with every request.
     * @param string|null $proxySecret Shared HMAC secret (`SHARPTOWN_PROXY_KEY`) for {@link signedUrl()}.
     * @param string $proxyPath Signed image-proxy endpoint path.
     */
    public function __construct(
        string $url,
        ?Transport $transport = null,
        array $headers = [],
        int $timeout = 30,
        ?string $proxySecret = null,
        string $proxyPath = '/api/v1/fetch',
    ) {
        $this->baseUrl = self::normalizeBaseUrl($url);
        $this->transport = $transport ?? new RestTransport();
        $this->headers = $headers;
        $this->timeout = $timeout;
        $this->proxySecret = $proxySecret;
        $this->proxyPath = $proxyPath;
    }

    /**
     * @param array<string, string> $headers Default headers sent with every request.
     */
    public static function create(
        string $url,
        ?Transport $transport = null,
        array $headers = [],
        int $timeout = 30,
        ?string $proxySecret = null,
        string $proxyPath = '/api/v1/fetch',
    ): self {
        return new self($url, $transport, $headers, $timeout, $proxySecret, $proxyPath);
    }

    /** The server base URL. */
    public function url(): string
    {
        return $this->baseUrl;
    }

    /**
     * Builds a signed image-proxy URL for the server's `GET /fetch` endpoint, suitable for an
     * `<img src>`. The server downloads `$source`, applies the operations, and serves a cached
     * result. The HMAC-SHA256 signature covers the source URL and every operation. Requires a
     * `proxySecret`; sign on a trusted server only, never ship the secret to a public client.
     *
     * @param array<string, mixed> $operations Canonical operations (`width`, `blur`, …).
     *
     * @example
     * $st = sharptown('https://img.example.com', proxySecret: getenv('SHARPTOWN_PROXY_KEY'));
     * $src = $st->signedUrl('https://example.com/photo.jpg', ['width' => 800, 'convertTo' => 'webp']);
     */
    public function signedUrl(string $source, array $operations = []): string
    {
        if ($source === '') {
            throw new SharptownError('signedUrl: source is required');
        }
        if ($this->proxySecret === null || $this->proxySecret === '') {
            throw new SharptownError('signedUrl requires a proxySecret: sharptown(url, proxySecret: ...)');
        }

        $params = Operations::toParams($operations);
        $params['url'] = $source;
        ksort($params, SORT_STRING);

        $canonical = [];
        foreach ($params as $key => $value) {
            $canonical[] = $key . '=' . $value;
        }
        $raw = hash_hmac('sha256', implode('&', $canonical), $this->proxySecret, true);
        $signature = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');

        $encoded = [];
        foreach ($params as $key => $value) {
            $encoded[] = rawurlencode($key) . '=' . rawurlencode($value);
        }
        $encoded[] = 'sig=' . $signature;

        return rtrim(Url::http($this->baseUrl), '/') . $this->proxyPath . '?' . implode('&', $encoded);
    }

    /**
     * Starts an image transformation chain.
     *
     * @param mixed $input The image source: a path/URL string, an {@link ImageInput}, an
     *   {@link SplFileInfo}, a stream resource, a PSR-7 `StreamInterface` (e.g. an S3/Guzzle
     *   body), or raw bytes via {@link ImageInput::fromString()}.
     * @param string|null $filename File name used in the multipart request.
     *
     * @example
     * $st->transform($file)->resize(400)->blur(2)->convert('webp')->toFile('out.webp');
     */
    public function transform(mixed $input, ?string $filename = null): TransformBuilder
    {
        return new TransformBuilder(
            $this->transport,
            $this->baseUrl,
            $this->headers,
            $this->timeout,
            ImageInput::from($input),
            $filename,
        );
    }

    /**
     * Shortcut: format conversion only.
     *
     * @param mixed $input Any source accepted by {@link transform()}.
     */
    public function convert(
        mixed $input,
        string $format,
        ?string $filename = null,
    ): TransformBuilder {
        return $this->transform($input, $filename)->convert($format);
    }

    /**
     * Shortcut: resize only.
     *
     * @param mixed $input Any source accepted by {@link transform()}.
     */
    public function resize(
        mixed $input,
        ?int $width = null,
        ?int $height = null,
        ?string $filename = null,
    ): TransformBuilder {
        return $this->transform($input, $filename)->resize($width, $height);
    }

    private static function normalizeBaseUrl(string $url): string
    {
        $trimmed = trim($url);
        if ($trimmed === '') {
            throw new SharptownError('sharptown(url): url must be a non-empty string');
        }
        return rtrim($trimmed, '/');
    }
}
