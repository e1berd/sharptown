<?php

declare(strict_types=1);

namespace Sharptown\Client;

/**
 * Operation validation, the canonical option set, and per-transport serialization.
 *
 * Option keys match `@sharptown/core` — the same names used by the REST query string and
 * the JSON-RPC `options` object. Each transport translates this canonical set into its own
 * wire format.
 */
final class Operations
{
    /** Output formats supported by the server. Mirrors `SUPPORTED_FORMATS` in core. */
    public const SUPPORTED_FORMATS = ['webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'heif'];

    /** Resize fit modes. Mirrors `FIT_MODES` in core. */
    public const FIT_MODES = ['cover', 'contain', 'fill', 'inside', 'outside'];

    /** Canonical option order, matching the JS client's query serialization. */
    public const ORDER = [
        'width', 'height', 'dpr', 'aspectRatio', 'fit', 'background', 'smartCrop',
        'crop', 'cropOffset', 'trim', 'chromaKey', 'composite', 'autoOrient', 'rotate', 'flip', 'blur', 'sharpen',
        'oilPaint', 'brightness', 'contrast', 'saturation', 'exposure', 'hue', 'gamma',
        'colorize', 'sepia', 'invert', 'threshold', 'r', 'g', 'b', 'grayscale',
        'removeAlpha', 'ensureAlpha', 'convertTo', 'quality', 'progressive', 'stripMetadata',
    ];

    /**
     * Coerces a value to an integer, throwing a clear error on invalid input.
     */
    public static function toInt(mixed $value, string $field): int
    {
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value) && is_finite($value) && floor($value) === $value) {
            return (int) $value;
        }
        if (is_string($value) && preg_match('/^-?\d+$/', $value) === 1) {
            return (int) $value;
        }
        throw new SharptownError(sprintf('Invalid %s: expected an integer, got %s', $field, self::describe($value)));
    }

    /**
     * Coerces a value to a finite number, throwing a clear error on invalid input.
     */
    public static function toNumber(mixed $value, string $field): float
    {
        if (is_int($value) || (is_float($value) && is_finite($value))) {
            return (float) $value;
        }
        if (is_string($value) && is_numeric($value) && is_finite((float) $value)) {
            return (float) $value;
        }
        throw new SharptownError(sprintf('Invalid %s: expected a number, got %s', $field, self::describe($value)));
    }

    /**
     * A number constrained to an inclusive range.
     */
    public static function toRange(mixed $value, string $field, float $min, float $max): float
    {
        $parsed = self::toNumber($value, $field);
        if ($parsed < $min || $parsed > $max) {
            throw new SharptownError(sprintf(
                'Invalid %s: expected %s–%s, got %s',
                $field,
                self::formatNumber($min),
                self::formatNumber($max),
                self::formatNumber($parsed),
            ));
        }
        return $parsed;
    }

    /**
     * An integer in the [0, 255] range — for tint colour channels.
     */
    public static function toColor(mixed $value, string $field): int
    {
        $parsed = self::toInt($value, $field);
        if ($parsed < 0 || $parsed > 255) {
            throw new SharptownError(sprintf('Invalid %s: expected 0-255, got %d', $field, $parsed));
        }
        return $parsed;
    }

    /**
     * A non-negative integer — for sizes and radii.
     */
    public static function toPositiveInt(mixed $value, string $field): int
    {
        $parsed = self::toInt($value, $field);
        if ($parsed < 0) {
            throw new SharptownError(sprintf('Invalid %s: expected a non-negative integer, got %d', $field, $parsed));
        }
        return $parsed;
    }

    /**
     * Asserts that a format is supported by the server.
     */
    public static function assertFormat(string $format): string
    {
        if (!in_array($format, self::SUPPORTED_FORMATS, true)) {
            throw new SharptownError(sprintf(
                'Unsupported format "%s". Supported: %s',
                $format,
                implode(', ', self::SUPPORTED_FORMATS),
            ));
        }
        return $format;
    }

    /**
     * Asserts that a fit mode is supported by the server.
     */
    public static function assertFit(string $fit): string
    {
        if (!in_array($fit, self::FIT_MODES, true)) {
            throw new SharptownError(sprintf(
                'Unsupported fit "%s". Supported: %s',
                $fit,
                implode(', ', self::FIT_MODES),
            ));
        }
        return $fit;
    }

    /**
     * Serializes canonical operations into a REST query string.
     *
     * @param array<string, mixed> $ops
     *
     * @example
     * Operations::toQuery(['width' => 500, 'convertTo' => 'webp']); // 'width=500&convertTo=webp'
     */
    public static function toQuery(array $ops): string
    {
        $pairs = [];
        foreach (self::ORDER as $key) {
            if (!array_key_exists($key, $ops) || $ops[$key] === null) {
                continue;
            }
            $pairs[] = rawurlencode($key) . '=' . rawurlencode(self::stringify($ops[$key]));
        }
        return implode('&', $pairs);
    }

    /**
     * Returns the canonical operations as stringified `key => value` pairs (only keys that
     * were set), matching the values the server receives as query parameters. Used to build
     * the signed image-proxy URL.
     *
     * @param array<string, mixed> $ops
     * @return array<string, string>
     */
    public static function toParams(array $ops): array
    {
        $params = [];
        foreach (self::ORDER as $key) {
            if (array_key_exists($key, $ops) && $ops[$key] !== null) {
                $params[$key] = self::stringify($ops[$key]);
            }
        }
        return $params;
    }

    /**
     * Returns the canonical operations as a JSON-RPC `options` object: only the keys that
     * were set, in canonical order, keeping native value types.
     *
     * @param array<string, mixed> $ops
     * @return array<string, mixed>
     */
    public static function toOptions(array $ops): array
    {
        $options = [];
        foreach (self::ORDER as $key) {
            if (array_key_exists($key, $ops) && $ops[$key] !== null) {
                $options[$key] = $ops[$key];
            }
        }
        return $options;
    }

    private static function stringify(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            return self::formatNumber($value);
        }
        return (string) $value;
    }

    private static function formatNumber(float $value): string
    {
        if ((float) (int) $value === $value) {
            return (string) (int) $value;
        }
        $formatted = rtrim(rtrim(sprintf('%.10F', $value), '0'), '.');
        return $formatted === '' ? '0' : $formatted;
    }

    private static function describe(mixed $value): string
    {
        if (is_string($value)) {
            return '"' . $value . '"';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_scalar($value) || $value === null) {
            return var_export($value, true);
        }
        return get_debug_type($value);
    }
}
