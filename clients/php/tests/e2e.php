<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Sharptown\Client\Input\ImageInput;
use Sharptown\Client\SharptownError;

use function Sharptown\Client\jsonrpc;
use function Sharptown\Client\sharptown;

$failures = 0;
$check = function (string $name, bool $ok, string $detail = '') use (&$failures): void {
    echo ($ok ? '  ok  ' : ' FAIL ') . $name . ($detail !== '' ? "  ($detail)" : '') . PHP_EOL;
    if (!$ok) {
        $failures++;
    }
};

$image = imagecreatetruecolor(120, 90);
imagefilledrectangle($image, 0, 0, 120, 90, imagecolorallocate($image, 30, 144, 255));
imagefilledellipse($image, 60, 45, 70, 50, imagecolorallocate($image, 255, 212, 0));
ob_start();
imagepng($image);
$png = (string) ob_get_clean();
imagedestroy($image);

$isWebp = static function (string $bytes): bool {
    $info = @getimagesizefromstring($bytes);
    return is_array($info) && ($info[2] ?? 0) === IMAGETYPE_WEBP;
};

echo '== REST ==' . PHP_EOL;
$rest = sharptown('http://localhost:3001');

$res = $rest->transform(ImageInput::fromString($png, 'in.png'))
    ->resize(64, 48)
    ->grayscale()
    ->convert('webp')
    ->quality(80)
    ->response();
$check('REST transform → 200', $res->ok(), 'status ' . $res->status());
$check('REST content-type is webp', $res->contentType() === 'image/webp', (string) $res->contentType());
$check('REST body is a valid WebP', $isWebp($res->body()), strlen($res->body()) . ' bytes');

$png2 = $rest->convert(ImageInput::fromString($png, 'in.png'), 'png')->bytes();
$dims = getimagesizefromstring($png2);
$check('REST convert(png) returns a PNG', is_array($dims) && $dims[2] === IMAGETYPE_PNG);

$memIn = fopen('php://memory', 'r+');
fwrite($memIn, $png);
rewind($memIn);
$memOut = fopen('php://memory', 'r+');
$written = $rest->transform($memIn)->resize(width: 40)->convert('webp')->toStream($memOut);
rewind($memOut);
$streamOut = stream_get_contents($memOut);
fclose($memIn);
fclose($memOut);
$check('REST stream-in → stream-out (no disk)', $written > 0 && $isWebp($streamOut), strlen($streamOut) . ' bytes');

$threw = false;
$status = null;
try {
    $rest->transform(ImageInput::fromString('not-an-image', 'broken.png'))->convert('webp')->bytes();
} catch (SharptownError $error) {
    $threw = true;
    $status = $error->status;
}
$check('REST rejects a corrupt image', $threw, 'status ' . var_export($status, true));

echo PHP_EOL . '== JSON-RPC ==' . PHP_EOL;
$rpc = sharptown('ws://localhost:3002', transport: jsonrpc());

$res = $rpc->transform(ImageInput::fromString($png, 'in.png'))
    ->resize(50)
    ->blur(2)
    ->convert('webp')
    ->response();
$check('JSON-RPC transform succeeds', $res->ok());
$check('JSON-RPC content-type is webp', $res->contentType() === 'image/webp', (string) $res->contentType());
$check('JSON-RPC body is a valid WebP', $isWebp($res->body()), strlen($res->body()) . ' bytes');

$threw = false;
try {
    $rpc->transform(ImageInput::fromString('not-an-image'))->convert('webp')->bytes();
} catch (SharptownError) {
    $threw = true;
}
$check('JSON-RPC rejects a corrupt image', $threw);

echo PHP_EOL . ($failures === 0 ? 'ALL PASSED' : "FAILURES: $failures") . PHP_EOL;
exit($failures === 0 ? 0 : 1);
