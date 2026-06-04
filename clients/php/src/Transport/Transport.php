<?php

declare(strict_types=1);

namespace Sharptown\Client\Transport;

use Sharptown\Client\Http\Response;

/**
 * A pluggable transport. Each implementation speaks one of the Sharptown protocols
 * (REST, JSON-RPC, gRPC) but accepts the same canonical {@link TransformRequest}.
 */
interface Transport
{
    public function transform(TransformRequest $request): Response;
}
