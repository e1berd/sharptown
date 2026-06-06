<?php

declare(strict_types=1);

namespace Sharptown\Client\Transport;

use Sharptown\Client\Http\CurlHttpClient;
use Sharptown\Client\Http\HttpClient;
use Sharptown\Client\Http\Request;
use Sharptown\Client\Http\Response;
use Sharptown\Client\Operations;
use Sharptown\Client\SharptownError;
use Sharptown\Client\Url;

/**
 * The REST transport — a `multipart/form-data` POST to `{baseUrl}/api/v1/transform` with
 * operations in the query string. This is the default transport.
 *
 * @example
 * use function Sharptown\Client\{sharptown, rest};
 *
 * $st = sharptown('http://localhost:3001', ['transport' => rest()]);
 */
final class RestTransport implements Transport
{
    public function __construct(
        private string $path = '/api/v1/transform',
        private string $field = 'image',
        private ?HttpClient $http = null,
    ) {
    }

    public function transform(TransformRequest $request): Response
    {
        $http = $this->http ?? new CurlHttpClient($request->timeout);
        $resolved = $request->input->resolve($http);
        $filename = $request->filename ?? $resolved['filename'];

        [$body, $contentType] = $this->multipart($filename, $resolved['contentType'], $resolved['bytes'], $request->attachments);
        $url = $this->endpoint($request->baseUrl, Operations::toQuery($request->operations));

        $headers = $request->headers;
        $headers['Content-Type'] = $contentType;

        $response = $http->send(new Request('POST', $url, $headers, $body));
        if (!$response->ok()) {
            throw $this->errorFor($response);
        }
        return $response;
    }

    private function errorFor(Response $response): SharptownError
    {
        $message = sprintf('Sharptown request failed with status %d', $response->status);
        $parsed = null;
        try {
            $parsed = $response->json();
        } catch (SharptownError) {
            $parsed = null;
        }
        if (is_array($parsed) && isset($parsed['error']) && is_string($parsed['error'])) {
            $message = $parsed['error'];
        }
        return new SharptownError($message, $response->status, $parsed);
    }

    /**
     * @param list<string> $attachments
     * @return array{0: string, 1: string}
     */
    private function multipart(string $filename, string $contentType, string $bytes, array $attachments = []): array
    {
        $boundary = '----SharptownBoundary' . bin2hex(random_bytes(16));
        $name = str_replace(['"', "\r", "\n"], '', $filename);
        $eol = "\r\n";

        $body = '--' . $boundary . $eol
            . 'Content-Disposition: form-data; name="' . $this->field . '"; filename="' . $name . '"' . $eol
            . 'Content-Type: ' . $contentType . $eol . $eol
            . $bytes . $eol;

        foreach ($attachments as $index => $overlay) {
            $body .= '--' . $boundary . $eol
                . 'Content-Disposition: form-data; name="watermark"; filename="watermark-' . $index . '"' . $eol
                . 'Content-Type: application/octet-stream' . $eol . $eol
                . $overlay . $eol;
        }

        $body .= '--' . $boundary . '--' . $eol;

        return [$body, 'multipart/form-data; boundary=' . $boundary];
    }

    private function endpoint(string $baseUrl, string $query): string
    {
        $url = Url::http($baseUrl) . $this->path;
        return $query !== '' ? $url . '?' . $query : $url;
    }
}
