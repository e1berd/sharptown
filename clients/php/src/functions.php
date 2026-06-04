<?php

declare(strict_types=1);

namespace Sharptown\Client;

use Sharptown\Client\Transport\JsonRpcTransport;
use Sharptown\Client\Transport\RestTransport;
use Sharptown\Client\Transport\Transport;

if (!function_exists('Sharptown\Client\sharptown')) {
    /**
     * Creates a Sharptown client.
     *
     * @param array<string, string> $headers Default headers sent with every request.
     *
     * @example
     * use function Sharptown\Client\{sharptown, jsonrpc};
     *
     * $st = sharptown('http://localhost:3001');
     * $rpc = sharptown('ws://localhost:3002', transport: jsonrpc());
     */
    function sharptown(
        string $url,
        ?Transport $transport = null,
        array $headers = [],
        int $timeout = 30,
    ): SharptownClient {
        return new SharptownClient($url, $transport, $headers, $timeout);
    }

    /**
     * The REST transport (default).
     */
    function rest(string $path = '/api/v1/transform', string $field = 'image'): RestTransport
    {
        return new RestTransport($path, $field);
    }

    /**
     * The JSON-RPC over WebSocket transport.
     */
    function jsonrpc(string $path = '/rpc', string $method = 'image.transform'): JsonRpcTransport
    {
        return new JsonRpcTransport($path, $method);
    }
}
