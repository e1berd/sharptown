<?php

declare(strict_types=1);

namespace Sharptown\Client;

use RuntimeException;
use Throwable;

/**
 * Error thrown by the Sharptown client — for invalid operations (validated before the
 * request) and for unsuccessful server responses.
 *
 * @example
 * use Sharptown\Client\SharptownError;
 *
 * try {
 *     $st->transform($file)->convert('webp')->bytes();
 * } catch (SharptownError $error) {
 *     echo $error->status, ' ', $error->getMessage();
 * }
 */
final class SharptownError extends RuntimeException
{
    /**
     * @param string $message Human-readable description.
     * @param int|null $status HTTP status, or JSON-RPC/gRPC code, when the error came from the server.
     * @param mixed $body Parsed error body, when present.
     * @param Throwable|null $previous Underlying error, when wrapping one.
     */
    public function __construct(
        string $message,
        public readonly ?int $status = null,
        public readonly mixed $body = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
