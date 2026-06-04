<?php

declare(strict_types=1);

namespace Sharptown\Client;

use Sharptown\Client\Transport\JsonRpcTransport;
use Sharptown\Client\Transport\RestTransport;

if (!function_exists('Sharptown\Client\sharptown')) {
    /**
     * Creates a Sharptown client.
     *
     * @param array{transport?: Transport\Transport, headers?: array<string, string>, timeout?: int} $options
     *
     * @example
     * use function Sharptown\Client\sharptown;
     *
     * $st = sharptown('http://localhost:3001');
     * $webp = $st->transform('photo.jpg')->resize(800)->convert('webp')->bytes();
     */
    function sharptown(string $url, array $options = []): SharptownClient
    {
        return new SharptownClient($url, $options);
    }

    /**
     * The REST transport (default).
     *
     * @param array{path?: string, field?: string} $options
     */
    function rest(array $options = []): RestTransport
    {
        return new RestTransport(
            $options['path'] ?? '/api/v1/transform',
            $options['field'] ?? 'image',
        );
    }

    /**
     * The JSON-RPC over WebSocket transport.
     *
     * @param array{path?: string, method?: string} $options
     */
    function jsonrpc(array $options = []): JsonRpcTransport
    {
        return new JsonRpcTransport(
            $options['path'] ?? '/rpc',
            $options['method'] ?? 'image.transform',
        );
    }
}
