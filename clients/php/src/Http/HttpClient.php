<?php

declare(strict_types=1);

namespace Sharptown\Client\Http;

/**
 * Minimal HTTP client abstraction. The default implementation is {@link CurlHttpClient};
 * a PSR-18 adapter can be written against this interface.
 */
interface HttpClient
{
    public function send(Request $request): Response;
}
