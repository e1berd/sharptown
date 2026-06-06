<?php

declare(strict_types=1);

namespace Sharptown\Client;

/**
 * A text overlay composited onto the result, rendered server-side. Pass it to
 * {@link TransformBuilder::composite()}.
 *
 * @example
 * $st->transform($file)
 *     ->composite((new Textmark('© Acme'))->size(48)->color('white')->rotate(-30)->tile())
 *     ->convert('webp');
 */
final class Textmark implements CompositeMark
{
    /** @var array<string, mixed> */
    private array $spec = ['type' => 'text'];

    public function __construct(string $text)
    {
        $this->spec['text'] = $text;
    }

    /** Font size in pixels. */
    public function size(int $value): self
    {
        $this->spec['size'] = Operations::toPositiveInt($value, 'textmark size');
        return $this;
    }

    /** Text colour (any CSS colour). */
    public function color(string $value): self
    {
        $this->spec['color'] = $value;
        return $this;
    }

    /** Font family. */
    public function font(string $value): self
    {
        $this->spec['font'] = $value;
        return $this;
    }

    /** Font weight (e.g. `bold`). */
    public function weight(string $value): self
    {
        $this->spec['weight'] = $value;
        return $this;
    }

    /** Background colour painted behind the text tile. */
    public function background(string $value): self
    {
        $this->spec['background'] = $value;
        return $this;
    }

    /** Rotates the text by degrees. */
    public function rotate(int $degrees): self
    {
        $this->spec['rotate'] = $degrees;
        return $this;
    }

    /** Text opacity (0–1). */
    public function opacity(int|float $value): self
    {
        $this->spec['opacity'] = Operations::toRange($value, 'textmark opacity', 0, 1);
        return $this;
    }

    /** Placement gravity. */
    public function gravity(string $value): self
    {
        $this->spec['gravity'] = $value;
        return $this;
    }

    /** Places the text at ($x, $y) from the top-left. */
    public function offset(int $x, int $y): self
    {
        $this->spec['x'] = $x;
        $this->spec['y'] = $y;
        return $this;
    }

    /** Repeats the text across the whole image. */
    public function tile(bool $enabled = true): self
    {
        $this->spec['tile'] = $enabled;
        return $this;
    }

    public function resolve(): array
    {
        return ['spec' => $this->spec, 'bytes' => null];
    }
}
