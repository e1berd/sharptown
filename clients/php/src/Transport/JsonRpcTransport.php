<?php

declare(strict_types=1);

namespace Sharptown\Client\Transport;

use Sharptown\Client\Http\Response;
use Sharptown\Client\Net\WebSocketClient;
use Sharptown\Client\Operations;
use Sharptown\Client\SharptownError;
use Sharptown\Client\Url;

/**
 * The JSON-RPC transport — calls `image.transform` over a WebSocket at `{baseUrl}/rpc`.
 * The image travels base64-encoded in the request and the result is base64-decoded back
 * to raw bytes, so the returned {@link Response} matches the REST transport's shape.
 *
 * The scheme is optional: a bare `localhost:3002` resolves to `wss://localhost:3002`. Without
 * a scheme the secure variant is used; pass `ws://` (or `http://`) explicitly to opt out.
 *
 * @example
 * use function Sharptown\Client\{sharptown, jsonrpc};
 *
 * $st = sharptown('ws://localhost:3002', transport: jsonrpc());
 */
final class JsonRpcTransport implements Transport
{
    public function __construct(
        private string $path = '/rpc',
        private string $method = 'image.transform',
    ) {
    }

    public function transform(TransformRequest $request): Response
    {
        $resolved = $request->input->resolve();

        $payload = [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $this->method,
            'params' => [
                'image' => base64_encode($resolved['bytes']),
                'options' => (object) Operations::toOptions($request->operations),
            ],
        ];

        $socket = new WebSocketClient($this->endpoint($request->baseUrl), $request->headers, $request->timeout);
        try {
            $socket->send(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            $raw = $socket->receive();
        } finally {
            $socket->close();
        }

        return $this->decode($raw);
    }

    private function decode(string $raw): Response
    {
        $message = json_decode($raw, true);
        if (!is_array($message)) {
            throw new SharptownError('Malformed JSON-RPC response');
        }

        if (isset($message['error'])) {
            $error = $message['error'];
            $text = is_array($error) && isset($error['message']) ? (string) $error['message'] : 'JSON-RPC error';
            $code = is_array($error) && isset($error['code']) ? (int) $error['code'] : null;
            throw new SharptownError($text, $code, $error);
        }

        $result = $message['result'] ?? null;
        if (!is_array($result) || !isset($result['image'])) {
            throw new SharptownError('JSON-RPC response is missing result.image');
        }

        $bytes = base64_decode((string) $result['image'], true);
        if ($bytes === false) {
            throw new SharptownError('JSON-RPC result.image is not valid base64');
        }

        $contentType = isset($result['contentType']) ? (string) $result['contentType'] : 'application/octet-stream';
        return new Response(200, ['content-type' => $contentType], $bytes);
    }

    private function endpoint(string $baseUrl): string
    {
        $base = Url::ws($baseUrl);
        $path = parse_url($base, PHP_URL_PATH);
        $hasPath = is_string($path) && $path !== '' && $path !== '/';
        return $hasPath ? $base : $base . $this->path;
    }
}
