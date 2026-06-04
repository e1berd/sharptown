<?php

declare(strict_types=1);

namespace Sharptown\Client\Http;

use CurlHandle;
use Sharptown\Client\SharptownError;

/**
 * The default {@link HttpClient}, built on ext-curl.
 *
 * The cURL handle is kept and reused across calls, so HTTP keep-alive works for free in
 * long-lived worker runtimes (FrankenPHP, RoadRunner). It is reset before every request,
 * so it stays correct across different hosts. Under PHP-FPM the handle is simply created
 * and released within the single request. The handle is not safe to share across threads —
 * use one client per worker.
 */
final class CurlHttpClient implements HttpClient
{
    private ?CurlHandle $handle = null;

    public function __construct(
        private int $timeout = 30,
        private int $connectTimeout = 10,
    ) {
    }

    public function send(Request $request): Response
    {
        $handle = $this->handle ??= curl_init();
        curl_reset($handle);

        $responseHeaders = [];
        curl_setopt_array($handle, [
            CURLOPT_URL => $request->url,
            CURLOPT_CUSTOMREQUEST => $request->method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => $this->connectTimeout,
            CURLOPT_HTTPHEADER => $this->formatHeaders($request->headers),
            CURLOPT_HEADERFUNCTION => static function ($_handle, string $line) use (&$responseHeaders): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return strlen($line);
            },
        ]);

        if ($request->body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $request->body);
        }

        $body = curl_exec($handle);
        if ($body === false) {
            throw new SharptownError(sprintf('HTTP request to %s failed: %s', $request->url, curl_error($handle)));
        }

        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        return new Response($status, $responseHeaders, (string) $body);
    }

    /**
     * Releases the underlying cURL handle. Optional — it is also released on destruction —
     * but useful to call between worker cycles when you want to drop pooled connections.
     */
    public function close(): void
    {
        if ($this->handle instanceof CurlHandle) {
            curl_close($this->handle);
            $this->handle = null;
        }
    }

    public function __destruct()
    {
        $this->close();
    }

    /**
     * @param array<string, string> $headers
     * @return list<string>
     */
    private function formatHeaders(array $headers): array
    {
        $formatted = [];
        foreach ($headers as $name => $value) {
            $formatted[] = $name . ': ' . $value;
        }
        return $formatted;
    }
}
