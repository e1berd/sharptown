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
     * @param array{transport?: Transport, headers?: array<string, string>, timeout?: int} $options
     */
    public function __construct(string $url, array $options = [])
    {
        $this->baseUrl = self::normalizeBaseUrl($url);
        $this->transport = $options['transport'] ?? new RestTransport();
        $this->headers = $options['headers'] ?? [];
        $this->timeout = $options['timeout'] ?? 30;
    }

    /**
     * @param array{transport?: Transport, headers?: array<string, string>, timeout?: int} $options
     */
    public static function create(string $url, array $options = []): self
    {
        return new self($url, $options);
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
     * @param array{filename?: string} $options
     *
     * @example
     * $st->transform($file)->resize(400)->blur(2)->convert('webp')->toFile('out.webp');
     */
    public function transform(string|ImageInput|SplFileInfo $input, array $options = []): TransformBuilder
    {
        return new TransformBuilder(
            $this->transport,
            $this->baseUrl,
            $this->headers,
            $this->timeout,
            ImageInput::from($input),
            $options['filename'] ?? null,
        );
    }

    /**
     * Shortcut: format conversion only.
     *
     * @param string|ImageInput|SplFileInfo $input
     * @param array{filename?: string} $options
     */
    public function convert(string|ImageInput|SplFileInfo $input, string $format, array $options = []): TransformBuilder
    {
        return $this->transform($input, $options)->convert($format);
    }

    /**
     * Shortcut: resize only.
     *
     * @param string|ImageInput|SplFileInfo $input
     * @param int|array{width?: int, height?: int} $width
     * @param array{filename?: string} $options
     */
    public function resize(
        string|ImageInput|SplFileInfo $input,
        int|array $width,
        ?int $height = null,
        array $options = [],
    ): TransformBuilder {
        return $this->transform($input, $options)->resize($width, $height);
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
