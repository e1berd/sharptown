<?php

declare(strict_types=1);

namespace Sharptown\Client\Transport;

use Sharptown\Client\Input\ImageInput;

/**
 * Everything a transport needs to perform a single transform, independent of protocol.
 */
final class TransformRequest
{
    /**
     * @param array<string, string> $headers
     * @param array<string, mixed> $operations Canonical operation set (see {@link \Sharptown\Client\Operations}).
     * @param list<string> $attachments Binary watermark overlays uploaded as `watermark` fields.
     */
    public function __construct(
        public readonly string $baseUrl,
        public readonly array $headers,
        public readonly ImageInput $input,
        public readonly ?string $filename,
        public readonly array $operations,
        public readonly int $timeout,
        public readonly array $attachments = [],
    ) {
    }
}
