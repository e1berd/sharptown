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
 * The base URL must match the chosen transport: the REST host (`http://…:3001`), the
 * JSON-RPC WebSocket host (`ws://…:3002`), or the gRPC host (`http://…:50051`).
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

    /**
     * @param array<string, string> $headers Default headers sent with every request.
     */
    public function __construct(
        string $url,
        ?Transport $transport = null,
        array $headers = [],
        int $timeout = 30,
    ) {
        $this->baseUrl = self::normalizeBaseUrl($url);
        $this->transport = $transport ?? new RestTransport();
        $this->headers = $headers;
        $this->timeout = $timeout;
    }

    /**
     * @param array<string, string> $headers Default headers sent with every request.
     */
    public static function create(
        string $url,
        ?Transport $transport = null,
        array $headers = [],
        int $timeout = 30,
    ): self {
        return new self($url, $transport, $headers, $timeout);
    }

    /** The server base URL. */
    public function url(): string
    {
        return $this->baseUrl;
    }

    /**
     * Starts an image transformation chain.
     *
     * @param string|ImageInput|SplFileInfo $input The image source (URL, path, or {@link ImageInput}).
     * @param string|null $filename File name used in the multipart request.
     *
     * @example
     * $st->transform($file)->resize(400)->blur(2)->convert('webp')->toFile('out.webp');
     */
    public function transform(string|ImageInput|SplFileInfo $input, ?string $filename = null): TransformBuilder
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
     * @param string|ImageInput|SplFileInfo $input
     */
    public function convert(
        string|ImageInput|SplFileInfo $input,
        string $format,
        ?string $filename = null,
    ): TransformBuilder {
        return $this->transform($input, $filename)->convert($format);
    }

    /**
     * Shortcut: resize only.
     *
     * @param string|ImageInput|SplFileInfo $input
     * @param int|array{width?: int, height?: int} $width
     */
    public function resize(
        string|ImageInput|SplFileInfo $input,
        int|array $width,
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
