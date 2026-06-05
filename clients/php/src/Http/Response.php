<?php

declare(strict_types=1);

namespace Sharptown\Client\Http;

use Sharptown\Client\SharptownError;

/**
 * The result of a transform: an HTTP-style response carrying the image bytes and headers.
 * Returned by {@link \Sharptown\Client\TransformBuilder::response()} for every transport.
 *
 * @example
 * $res = $st->transform($file)->convert('webp')->response();
 * echo $res->contentType();        // image/webp
 * file_put_contents('out.webp', $res->body());
 */
final class Response
{
    /**
     * @param int $status HTTP status (synthesised as 200 for non-HTTP transports).
     * @param array<string, string> $headers Header map with lowercased names.
     * @param string $body Raw response bytes.
     */
    public function __construct(
        public readonly int $status,
        public readonly array $headers,
        public readonly string $body,
    ) {
    }

    public function ok(): bool
    {
        return $this->status >= 200 && $this->status < 300;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function contentType(): ?string
    {
        return $this->header('content-type');
    }

    public function body(): string
    {
        return $this->body;
    }

    public function bytes(): string
    {
        return $this->body;
    }

    /**
     * Decodes the body as JSON.
     *
     * @return mixed
     */
    public function json(): mixed
    {
        $decoded = json_decode($this->body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new SharptownError('Invalid JSON response: ' . json_last_error_msg());
        }
        return $decoded;
    }

    /**
     * Writes the body to a file and returns the path.
     */
    public function toFile(string $path): string
    {
        if (file_put_contents($path, $this->body) === false) {
            throw new SharptownError(sprintf('Failed to write file: %s', $path));
        }
        return $path;
    }

    /**
     * Writes the body to an open stream resource (e.g. `php://output`, `php://memory`, an
     * S3 upload stream) without touching disk. Returns the number of bytes written.
     *
     * @param resource $stream
     */
    public function toStream($stream): int
    {
        if (!is_resource($stream)) {
            throw new SharptownError('toStream() expects an open, writable stream resource');
        }
        $written = fwrite($stream, $this->body);
        if ($written === false) {
            throw new SharptownError('Failed to write the result to the stream');
        }
        return $written;
    }
}
