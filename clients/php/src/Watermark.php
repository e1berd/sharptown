<?php

declare(strict_types=1);

namespace Sharptown\Client;

/**
 * An image overlay composited onto the result. Build it from a URL the server fetches
 * ({@link url()}), or from local bytes/a file uploaded with the request ({@link bytes()},
 * {@link file()}), then chain the placement and appearance methods.
 *
 * @example
 * $st->transform($file)
 *     ->composite(Watermark::url('https://cdn.example.com/logo.png')->resize(120)->opacity(0.6))
 *     ->convert('webp');
 */
final class Watermark implements CompositeMark
{
    /** @var array<string, mixed> */
    private array $spec = ['type' => 'image'];
    private ?string $upload = null;

    private function __construct()
    {
    }

    /** An image watermark fetched from $url by the server. */
    public static function url(string $url): self
    {
        $mark = new self();
        $mark->spec['url'] = $url;
        return $mark;
    }

    /** An image watermark uploaded from raw bytes. */
    public static function bytes(string $data): self
    {
        $mark = new self();
        $mark->upload = $data;
        return $mark;
    }

    /** An image watermark uploaded from a local file path. */
    public static function file(string $path): self
    {
        $data = @file_get_contents($path);
        if ($data === false) {
            throw new SharptownError(sprintf('Watermark::file: cannot read %s', $path));
        }
        return self::bytes($data);
    }

    /** Fits the overlay inside $width×$height. Either dimension is optional. */
    public function resize(?int $width = null, ?int $height = null): self
    {
        if ($width !== null) {
            $this->spec['width'] = Operations::toPositiveInt($width, 'watermark width');
        }
        if ($height !== null) {
            $this->spec['height'] = Operations::toPositiveInt($height, 'watermark height');
        }
        return $this;
    }

    /** Sets the overlay width only. */
    public function width(int $value): self
    {
        $this->spec['width'] = Operations::toPositiveInt($value, 'watermark width');
        return $this;
    }

    /** Sets the overlay height only. */
    public function height(int $value): self
    {
        $this->spec['height'] = Operations::toPositiveInt($value, 'watermark height');
        return $this;
    }

    /** Rotates the overlay by degrees. */
    public function rotate(int $degrees): self
    {
        $this->spec['rotate'] = $degrees;
        return $this;
    }

    /** Sets the overlay opacity (0–1). */
    public function opacity(int|float $value): self
    {
        $this->spec['opacity'] = Operations::toRange($value, 'watermark opacity', 0, 1);
        return $this;
    }

    /** Sets the placement gravity (default southeast). */
    public function gravity(string $value): self
    {
        $this->spec['gravity'] = $value;
        return $this;
    }

    /** Places the overlay at ($x, $y) from the top-left instead of a gravity. */
    public function offset(int $x, int $y): self
    {
        $this->spec['x'] = $x;
        $this->spec['y'] = $y;
        return $this;
    }

    /** Repeats the overlay across the whole image. */
    public function tile(bool $enabled = true): self
    {
        $this->spec['tile'] = $enabled;
        return $this;
    }

    /** Sets the Sharp blend mode (default over). */
    public function blend(string $mode): self
    {
        $this->spec['blend'] = $mode;
        return $this;
    }

    public function resolve(): array
    {
        return ['spec' => $this->spec, 'bytes' => $this->upload];
    }
}
