<?php

declare(strict_types=1);

namespace Sharptown\Client\Input;

use SplFileInfo;
use Sharptown\Client\Http\CurlHttpClient;
use Sharptown\Client\Http\HttpClient;
use Sharptown\Client\Http\Request;
use Sharptown\Client\SharptownError;

/**
 * A deferred image source. Resolved to raw bytes at request time so a URL is only fetched
 * and a file only read when the transform actually runs.
 *
 * Bare strings passed to {@link from()} are treated as an `http(s)` URL or an existing file
 * path — never as raw bytes. For in-memory bytes use {@link fromString()}.
 *
 * @example
 * ImageInput::fromPath('photo.jpg');
 * ImageInput::fromString($binary, 'upload.png');
 * ImageInput::fromUrl('https://example.com/cat.jpg');
 */
final class ImageInput
{
    private const KIND_PATH = 'path';
    private const KIND_BYTES = 'bytes';
    private const KIND_URL = 'url';
    private const KIND_RESOURCE = 'resource';

    private function __construct(
        private string $kind,
        private mixed $source,
        private ?string $filename,
    ) {
    }

    public static function fromPath(string $path, ?string $filename = null): self
    {
        return new self(self::KIND_PATH, $path, $filename);
    }

    public static function fromString(string $bytes, string $filename = 'image'): self
    {
        return new self(self::KIND_BYTES, $bytes, $filename);
    }

    public static function fromUrl(string $url, ?string $filename = null): self
    {
        return new self(self::KIND_URL, $url, $filename);
    }

    /**
     * @param resource $resource An open, readable stream.
     */
    public static function fromResource($resource, string $filename = 'image'): self
    {
        if (!is_resource($resource)) {
            throw new SharptownError('ImageInput::fromResource() expects an open stream resource');
        }
        return new self(self::KIND_RESOURCE, $resource, $filename);
    }

    /**
     * Normalizes any accepted input into an {@link ImageInput}.
     *
     * @param string|self|SplFileInfo $input
     */
    public static function from(string|self|SplFileInfo $input): self
    {
        if ($input instanceof self) {
            return $input;
        }
        if ($input instanceof SplFileInfo) {
            return self::fromPath($input->getPathname());
        }
        if (preg_match('#^https?://#i', $input) === 1) {
            return self::fromUrl($input);
        }
        if (is_file($input)) {
            return self::fromPath($input);
        }
        throw new SharptownError(sprintf(
            'transform(): "%s" is not an http(s) URL or an existing file. For raw image bytes use ImageInput::fromString().',
            $input,
        ));
    }

    /**
     * Reads the source into bytes plus a filename and content type.
     *
     * @return array{bytes: string, filename: string, contentType: string}
     */
    public function resolve(?HttpClient $http = null): array
    {
        return match ($this->kind) {
            self::KIND_PATH => $this->resolvePath(),
            self::KIND_BYTES => $this->resolveBytes(),
            self::KIND_URL => $this->resolveUrl($http ?? new CurlHttpClient()),
            self::KIND_RESOURCE => $this->resolveResource(),
            default => throw new SharptownError('Unknown image input kind: ' . $this->kind),
        };
    }

    /**
     * @return array{bytes: string, filename: string, contentType: string}
     */
    private function resolvePath(): array
    {
        $path = (string) $this->source;
        if (!is_file($path)) {
            throw new SharptownError(sprintf('Image file not found: %s', $path));
        }
        $bytes = file_get_contents($path);
        if ($bytes === false) {
            throw new SharptownError(sprintf('Failed to read image file: %s', $path));
        }
        $filename = $this->filename ?? (basename($path) ?: 'image');
        return ['bytes' => $bytes, 'filename' => $filename, 'contentType' => self::guessContentType($filename)];
    }

    /**
     * @return array{bytes: string, filename: string, contentType: string}
     */
    private function resolveBytes(): array
    {
        $filename = $this->filename ?? 'image';
        return ['bytes' => (string) $this->source, 'filename' => $filename, 'contentType' => self::guessContentType($filename)];
    }

    /**
     * @return array{bytes: string, filename: string, contentType: string}
     */
    private function resolveUrl(HttpClient $http): array
    {
        $url = (string) $this->source;
        $response = $http->send(new Request('GET', $url));
        if (!$response->ok()) {
            throw new SharptownError(
                sprintf('Failed to fetch input from %s: %d', $url, $response->status),
                $response->status,
            );
        }
        $path = (string) parse_url($url, PHP_URL_PATH);
        $filename = $this->filename ?? (basename($path) ?: 'image');
        $contentType = $response->contentType() ?? self::guessContentType($filename);
        return ['bytes' => $response->body(), 'filename' => $filename, 'contentType' => $contentType];
    }

    /**
     * @return array{bytes: string, filename: string, contentType: string}
     */
    private function resolveResource(): array
    {
        $bytes = stream_get_contents($this->source);
        if ($bytes === false) {
            throw new SharptownError('Failed to read image input stream');
        }
        $filename = $this->filename ?? 'image';
        return ['bytes' => $bytes, 'filename' => $filename, 'contentType' => self::guessContentType($filename)];
    }

    private static function guessContentType(string $filename): string
    {
        static $map = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'avif' => 'image/avif',
            'heif' => 'image/heif',
            'heic' => 'image/heif',
            'tif' => 'image/tiff',
            'tiff' => 'image/tiff',
            'bmp' => 'image/bmp',
            'svg' => 'image/svg+xml',
        ];
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return $map[$extension] ?? 'application/octet-stream';
    }
}
