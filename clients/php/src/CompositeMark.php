<?php

declare(strict_types=1);

namespace Sharptown\Client;

/**
 * An overlay passed to {@link TransformBuilder::composite()} — a {@link Watermark} (image)
 * or a {@link Textmark} (text).
 */
interface CompositeMark
{
    /**
     * Resolves the overlay into its wire spec, plus optional bytes to upload.
     *
     * @return array{spec: array<string, mixed>, bytes: ?string}
     */
    public function resolve(): array;
}
