<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Sharptown\Client\Http\Response;
use Sharptown\Client\Input\ImageInput;
use Sharptown\Client\Operations;
use Sharptown\Client\SharptownError;
use Sharptown\Client\Transport\Transport;
use Sharptown\Client\Transport\TransformRequest;

use function Sharptown\Client\sharptown;

$failures = 0;
$assert = function (string $name, bool $ok) use (&$failures): void {
    echo ($ok ? '  ok  ' : ' FAIL ') . $name . PHP_EOL;
    if (!$ok) {
        $failures++;
    }
};

/** Captures the request a transport would send, without any networking. */
$capture = new class implements Transport {
    public ?TransformRequest $request = null;

    public function transform(TransformRequest $request): Response
    {
        $this->request = $request;
        return new Response(200, ['content-type' => 'image/webp'], 'BYTES');
    }
};

$st = sharptown('http://localhost:3001/', transport: $capture);

$bytes = $st->transform(ImageInput::fromString('rawpngbytes', 'in.png'))
    ->resize(800, 600)
    ->blur(3)
    ->grayscale()
    ->sharpen()
    ->saturation(1.2)
    ->aspectRatio(16 / 9)
    ->convert('webp')
    ->quality(80)
    ->bytes();

$assert('terminal returns transport bytes', $bytes === 'BYTES');

$ops = $capture->request->operations;
$query = Operations::toQuery($ops);

$assert('query keeps canonical order + values',
    $query === 'width=800&height=600&aspectRatio=1.7777777778&blur=3&sharpen=true&saturation=1.2&grayscale=true&convertTo=webp&quality=80');

$options = Operations::toOptions($ops);
$assert('options carry native types', $options['grayscale'] === true && $options['sharpen'] === true && $options['width'] === 800);
$assert('options skip unset keys', !array_key_exists('height', array_diff_key($options, ['height' => 1])) && !isset($options['rotate']));

$assert('base url trailing slash stripped', $st->url() === 'http://localhost:3001');

$threw = false;
try {
    $st->transform(ImageInput::fromString('x'))->convert('tiff');
} catch (SharptownError) {
    $threw = true;
}
$assert('unsupported format rejected', $threw);

$threw = false;
try {
    $st->transform(ImageInput::fromString('x'))->saturation(9);
} catch (SharptownError) {
    $threw = true;
}
$assert('out-of-range value rejected', $threw);

$threw = false;
try {
    ImageInput::from('definitely-not-a-real-file.zzz');
} catch (SharptownError) {
    $threw = true;
}
$assert('bare non-file string rejected', $threw);

$resolved = ImageInput::fromString('abc', 'pic.jpg')->resolve();
$assert('fromString resolves bytes + content type',
    $resolved['bytes'] === 'abc' && $resolved['contentType'] === 'image/jpeg' && $resolved['filename'] === 'pic.jpg');

echo PHP_EOL . ($failures === 0 ? 'ALL PASSED' : "FAILURES: $failures") . PHP_EOL;
exit($failures === 0 ? 0 : 1);
