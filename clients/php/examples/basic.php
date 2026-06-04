<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Sharptown\Client\SharptownError;

use function Sharptown\Client\jsonrpc;
use function Sharptown\Client\sharptown;

$source = $argv[1] ?? null;
if ($source === null) {
    fwrite(STDERR, "usage: php examples/basic.php <image-path-or-url>\n");
    exit(1);
}

try {
    $rest = sharptown('http://localhost:3001');
    $rest->transform($source)
        ->resize(800)
        ->saturation(1.1)
        ->convert('webp')
        ->quality(82)
        ->toFile(__DIR__ . '/out-rest.webp');
    echo "REST  -> examples/out-rest.webp\n";

    $rpc = sharptown('ws://localhost:3002', transport: jsonrpc());
    $rpc->transform($source)
        ->resize(400)
        ->grayscale()
        ->convert('png')
        ->toFile(__DIR__ . '/out-rpc.png');
    echo "JSON-RPC -> examples/out-rpc.png\n";
} catch (SharptownError $error) {
    fwrite(STDERR, sprintf("error (%s): %s\n", var_export($error->status, true), $error->getMessage()));
    exit(1);
}
