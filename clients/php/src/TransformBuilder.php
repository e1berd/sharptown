<?php

declare(strict_types=1);

namespace Sharptown\Client;

use Sharptown\Client\Http\Response;
use Sharptown\Client\Input\ImageInput;
use Sharptown\Client\Transport\Transport;
use Sharptown\Client\Transport\TransformRequest;

/**
 * A chainable builder for transforming a single image. Every operation method returns
 * `$this`, so calls can be chained; a terminal method ({@link bytes()}, {@link response()},
 * {@link toFile()}) runs the request.
 *
 * @example
 * $bytes = $st->transform($file)
 *     ->resize(800, 600)
 *     ->blur(3)
 *     ->grayscale()
 *     ->convert('webp')
 *     ->bytes();
 */
final class TransformBuilder
{
    /** @var array<string, mixed> */
    private array $ops = [];

    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        private Transport $transport,
        private string $baseUrl,
        private array $headers,
        private int $timeout,
        private ImageInput $input,
        private ?string $filename,
    ) {
    }

    /**
     * Resize. Pass `width` and/or `height` — positionally or by name.
     *
     * @example
     * $st->transform($file)->resize(800, 600);
     * $st->transform($file)->resize(width: 800);
     */
    public function resize(?int $width = null, ?int $height = null): static
    {
        if ($width !== null) {
            $this->ops['width'] = Operations::toPositiveInt($width, 'width');
        }
        if ($height !== null) {
            $this->ops['height'] = Operations::toPositiveInt($height, 'height');
        }
        return $this;
    }

    public function width(int $value): static
    {
        $this->ops['width'] = Operations::toPositiveInt($value, 'width');
        return $this;
    }

    public function height(int $value): static
    {
        $this->ops['height'] = Operations::toPositiveInt($value, 'height');
        return $this;
    }

    /**
     * Crops a rectangle. Pass the corner and size positionally or by name.
     *
     * @example
     * $st->transform($file)->crop(10, 20, 300, 200);
     * $st->transform($file)->crop(left: 10, top: 20, width: 300, height: 200);
     */
    public function crop(int $left, int $top, int $width, int $height): static
    {
        $this->ops['crop'] = implode(',', [
            Operations::toPositiveInt($left, 'crop.left'),
            Operations::toPositiveInt($top, 'crop.top'),
            Operations::toPositiveInt($width, 'crop.width'),
            Operations::toPositiveInt($height, 'crop.height'),
        ]);
        return $this;
    }

    /**
     * Crops to the most salient region when resizing. Combine with a target width/height.
     */
    public function smartCrop(bool $enabled = true): static
    {
        $this->ops['smartCrop'] = $enabled;
        return $this;
    }

    /**
     * Sets the resize fit mode: `cover`, `contain`, `fill`, `inside`, `outside`.
     */
    public function fit(string $mode): static
    {
        $this->ops['fit'] = Operations::assertFit(strtolower($mode));
        return $this;
    }

    /**
     * Background colour used by `fit: 'contain'` (e.g. `white`, `#000`, `rgba(0,0,0,0)`).
     */
    public function background(string $color): static
    {
        $this->ops['background'] = $color;
        return $this;
    }

    /**
     * Device pixel ratio; multiplies the target width/height for retina screens.
     */
    public function dpr(int|float $value): static
    {
        $this->ops['dpr'] = Operations::toRange($value, 'dpr', 0.1, 5);
        return $this;
    }

    /**
     * Target aspect ratio (width / height). Combine with a width or height.
     */
    public function aspectRatio(int|float $ratio): static
    {
        $this->ops['aspectRatio'] = Operations::toRange($ratio, 'aspectRatio', 0.0001, 1000);
        return $this;
    }

    /** Rotates according to the EXIF orientation tag. */
    public function autoOrient(bool $enabled = true): static
    {
        $this->ops['autoOrient'] = $enabled;
        return $this;
    }

    /** Rotates by the given degrees. */
    public function rotate(int $degrees): static
    {
        $this->ops['rotate'] = Operations::toInt($degrees, 'rotate');
        return $this;
    }

    /** Flips horizontally. */
    public function flip(bool $enabled = true): static
    {
        $this->ops['flip'] = $enabled;
        return $this;
    }

    /** Blurs by the given sigma/radius. */
    public function blur(int $sigma = 1): static
    {
        $this->ops['blur'] = Operations::toPositiveInt($sigma, 'blur');
        return $this;
    }

    /**
     * Tints with a colour. Each channel is optional (0–255); pass them positionally or by name.
     *
     * @example
     * $st->transform($file)->tint(255, 0, 0);
     * $st->transform($file)->tint(b: 20);
     */
    public function tint(?int $r = null, ?int $g = null, ?int $b = null): static
    {
        if ($r !== null) {
            $this->ops['r'] = Operations::toColor($r, 'r');
        }
        if ($g !== null) {
            $this->ops['g'] = Operations::toColor($g, 'g');
        }
        if ($b !== null) {
            $this->ops['b'] = Operations::toColor($b, 'b');
        }
        return $this;
    }

    /** Desaturates the image. */
    public function grayscale(bool $enabled = true): static
    {
        $this->ops['grayscale'] = $enabled;
        return $this;
    }

    /** British alias of {@link grayscale()}. */
    public function greyscale(bool $enabled = true): static
    {
        return $this->grayscale($enabled);
    }

    /** Removes the alpha channel. */
    public function removeAlpha(bool $enabled = true): static
    {
        $this->ops['removeAlpha'] = $enabled;
        return $this;
    }

    /** Ensures an alpha channel exists. */
    public function ensureAlpha(bool $enabled = true): static
    {
        $this->ops['ensureAlpha'] = $enabled;
        return $this;
    }

    /** Adjusts brightness, `-100`–`100`. */
    public function brightness(int|float $value): static
    {
        $this->ops['brightness'] = Operations::toRange($value, 'brightness', -100, 100);
        return $this;
    }

    /** Adjusts contrast, `-100`–`100`. */
    public function contrast(int|float $value): static
    {
        $this->ops['contrast'] = Operations::toRange($value, 'contrast', -100, 100);
        return $this;
    }

    /** Adjusts saturation, `0`–`2` (`1` is the original). */
    public function saturation(int|float $value): static
    {
        $this->ops['saturation'] = Operations::toRange($value, 'saturation', 0, 2);
        return $this;
    }

    /** Adjusts exposure in EV stops, `-3`–`3`. */
    public function exposure(int|float $value): static
    {
        $this->ops['exposure'] = Operations::toRange($value, 'exposure', -3, 3);
        return $this;
    }

    /** Rotates hue in degrees, `0`–`360`. */
    public function hue(int|float $value): static
    {
        $this->ops['hue'] = Operations::toRange($value, 'hue', 0, 360);
        return $this;
    }

    /** Gamma correction, `1.0`–`3.0`. */
    public function gamma(int|float $value): static
    {
        $this->ops['gamma'] = Operations::toRange($value, 'gamma', 1, 3);
        return $this;
    }

    /** Maps the image to shades of one colour (greyscale + tint). */
    public function colorize(string $color): static
    {
        $this->ops['colorize'] = $color;
        return $this;
    }

    /** Applies a sepia tone. Intensity `0`–`1`, defaulting to full sepia. */
    public function sepia(int|float $intensity = 1): static
    {
        $this->ops['sepia'] = Operations::toRange($intensity, 'sepia', 0, 1);
        return $this;
    }

    /** Inverts colours. */
    public function invert(bool $enabled = true): static
    {
        $this->ops['invert'] = $enabled;
        return $this;
    }

    /** Binarises the image at the given threshold, `0`–`255`. */
    public function threshold(int|float $value): static
    {
        $this->ops['threshold'] = Operations::toRange($value, 'threshold', 0, 255);
        return $this;
    }

    /**
     * Sharpens the image. With no argument enables the default; otherwise sets the sigma `0`–`5`.
     */
    public function sharpen(int|float|null $sigma = null): static
    {
        $this->ops['sharpen'] = $sigma === null ? true : Operations::toRange($sigma, 'sharpen', 0, 5);
        return $this;
    }

    /** Oil-paint effect via a median filter; the value is the window size (`1`–`25`). */
    public function oilPaint(int|float $size = 3): static
    {
        $this->ops['oilPaint'] = Operations::toRange($size, 'oilPaint', 1, 25);
        return $this;
    }

    /** Output quality `1`–`100` (applies when re-encoding via {@link convert()}). */
    public function quality(int|float $value): static
    {
        $this->ops['quality'] = Operations::toRange($value, 'quality', 1, 100);
        return $this;
    }

    /** Progressive (interlaced) output when re-encoding. */
    public function progressive(bool $enabled = true): static
    {
        $this->ops['progressive'] = $enabled;
        return $this;
    }

    /** Strips EXIF/metadata (the default). Pass `false` to keep metadata. */
    public function stripMetadata(bool $enabled = true): static
    {
        $this->ops['stripMetadata'] = $enabled;
        return $this;
    }

    /**
     * Converts to a format (`webp`, `png`, `jpg`, `jpeg`, `avif`, `gif`, `heif`).
     */
    public function convert(string $format): static
    {
        $this->ops['convertTo'] = Operations::assertFormat(strtolower($format));
        return $this;
    }

    /** Alias of {@link convert()}. */
    public function toFormat(string $format): static
    {
        return $this->convert($format);
    }

    /**
     * Returns the canonical operation set accumulated so far.
     *
     * @return array<string, mixed>
     */
    public function operations(): array
    {
        return $this->ops;
    }

    /**
     * Runs the request and returns the full {@link Response} (status, headers, bytes).
     */
    public function response(): Response
    {
        return $this->transport->transform(new TransformRequest(
            $this->baseUrl,
            $this->headers,
            $this->input,
            $this->filename,
            $this->ops,
            $this->timeout,
        ));
    }

    /** Runs the request and returns the raw image bytes. */
    public function bytes(): string
    {
        return $this->response()->body();
    }

    /** Runs the request and writes the result to a file, returning the path. */
    public function toFile(string $path): string
    {
        return $this->response()->toFile($path);
    }

    /** Alias of {@link toFile()}. */
    public function save(string $path): string
    {
        return $this->toFile($path);
    }

    /**
     * Runs the request and writes the result to a stream resource without touching disk.
     * Returns the number of bytes written.
     *
     * @param resource $stream
     */
    public function toStream($stream): int
    {
        return $this->response()->toStream($stream);
    }
}
