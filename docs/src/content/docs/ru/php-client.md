---
title: PHP-клиент
description: Выразительный чейнящийся PHP-клиент для REST, JSON-RPC и gRPC — единый API без обязательных зависимостей.
group: Guide
order: 3
---

# PHP-клиент

`sharptown/client` — выразительный чейнящийся клиент для PHP. Он даёт **единый API для всех
трёх транспортов** — REST (по умолчанию), JSON-RPC и gRPC (в работе) — и не требует сторонних
зависимостей (только `ext-curl` и `ext-json`). Работает одинаково и в классическом PHP-FPM, и
в долгоживущих воркерах (FrankenPHP, RoadRunner).

## Установка

```bash
composer require sharptown/client
```

Требуется PHP >= 8.1.

## Создание клиента

```php
use function Sharptown\Client\sharptown;

$st = sharptown('http://localhost:3001');
```

`sharptown()` принимает базовый URL и именованные аргументы:

| Аргумент | Тип | По умолчанию | Назначение |
| -------- | --- | ------------ | ---------- |
| `transport` | `Transport` | `rest()` | Подключаемый транспорт. |
| `headers` | `array` | `[]` | Заголовки по умолчанию для каждого запроса (например, авторизация). |
| `timeout` | `int` | `30` | Таймаут запроса, в секундах. |

Базовый URL должен соответствовать выбранному транспорту.

## Выбор транспорта

```php
use function Sharptown\Client\{sharptown, rest, jsonrpc};

// REST (по умолчанию) — multipart POST на /api/v1/transform
$rest = sharptown('http://localhost:3001');

// JSON-RPC поверх WebSocket — image.transform на /rpc
$rpc = sharptown('ws://localhost:3002', transport: jsonrpc());
```

Все транспорты принимают один и тот же билдер, одинаково валидируют операции и возвращают
один и тот же `Response`, поэтому замена транспорта не меняет ваш код вызова.

## Цепочка трансформации

`$st->transform($input)` возвращает чейнящийся **`TransformBuilder`**. Каждый метод операции
возвращает `$this`, так что вы собираете конвейер и завершаете его терминальным методом.

```php
$bytes = $st->transform($file)
    ->resize(800, 600)
    ->blur(3)
    ->grayscale()
    ->convert('webp')
    ->bytes();
```

### Допустимые входы — без диска

`transform()` принимает строку-путь/URL, `SplFileInfo`, **поток-ресурс**, **PSR-7
`StreamInterface`** или сырые байты — поэтому изображение можно редактировать целиком в
памяти, не читая с диска и не записывая на него. (Обычная строка — это `http(s)`-URL или путь
к файлу, но не сырые байты; для байтов используйте `ImageInput::fromString()`.)

```php
use Sharptown\Client\Input\ImageInput;

$st->transform('photo.jpg');                    // путь к файлу (диск)
$st->transform('https://example.com/cat.jpg');  // загрузка по HTTP
$st->transform($streamResource);                // любой поток (php://memory, загрузка…)
$st->transform(ImageInput::fromString($binary, 'upload.png')); // сырые байты
```

#### Из S3 / Guzzle, целиком в памяти

Тело объекта S3 (AWS SDK) или тело ответа Guzzle — это PSR-7 `StreamInterface`; передайте его
напрямую, диск не задействуется:

```php
$object = $s3->getObject(['Bucket' => 'bucket', 'Key' => 'photo.jpg']);

$webp = $st->transform($object['Body'])   // PSR-7-поток из S3
    ->resize(width: 1280)
    ->convert('webp')
    ->bytes();                            // результат тоже остаётся в памяти
```

### Методы операций

Размер и кадрирование:

| Метод | Описание |
| ----- | -------- |
| `->resize($width, $height = null)` | Изменение размера. Можно по имени: `->resize(width: 800)`. |
| `->width($n)` / `->height($n)` | Задать одну сторону. |
| `->crop($left, $top, $width, $height)` | Вырезать прямоугольник. Можно по имени: `->crop(left: 10, top: 20, width: 300, height: 200)`. |
| `->smartCrop($enabled = true)` | Кадрировать по значимой области при ресайзе. |
| `->fit($mode)` | `cover` / `contain` / `fill` / `inside` / `outside`. |
| `->background($color)` | Фон для `fit: 'contain'`. |
| `->dpr($value)` | Device pixel ratio; умножает целевой размер. |
| `->aspectRatio($ratio)` | Целевое соотношение; комбинируйте с `->width()`/`->height()`. |
| `->autoOrient($enabled = true)` | Поворот по EXIF-ориентации. |
| `->rotate($deg)` | Поворот на градусы. |
| `->flip($enabled = true)` | Отражение по горизонтали. |

Тон, цвет и эффекты:

| Метод | Описание |
| ----- | -------- |
| `->brightness($n)` | Яркость `-100`–`100`. |
| `->contrast($n)` | Контраст `-100`–`100`. |
| `->saturation($n)` | Насыщенность `0`–`2`. |
| `->exposure($n)` | Экспозиция в EV `-3`–`3`. |
| `->hue($n)` | Поворот оттенка `0`–`360`. |
| `->gamma($n)` | Гамма `1.0`–`3.0`. |
| `->colorize($color)` | Свести к оттенкам одного цвета. |
| `->tint($r, $g, $b)` | Тонирование; каждый канал необязателен, можно по имени: `->tint(r: 255)`. |
| `->grayscale($enabled = true)` | Обесцветить (`->greyscale` — алиас). |
| `->blur($sigma = 1)` | Размытие по Гауссу. |
| `->sharpen($sigma = null)` | Резкость; без аргумента — значение по умолчанию. |
| `->sepia($intensity = 1)` | Сепия `0`–`1`. |
| `->invert($enabled = true)` | Инверсия цветов. |
| `->threshold($n)` | Бинаризация на `0`–`255`. |
| `->oilPaint($size = 3)` | Эффект масляной краски (медианный фильтр). |

Альфа и вывод:

| Метод | Описание |
| ----- | -------- |
| `->removeAlpha()` / `->ensureAlpha()` | Управление альфа-каналом. |
| `->quality($n)` | Качество вывода `1`–`100` (с `->convert()`). |
| `->progressive($enabled = true)` | Прогрессивный вывод. |
| `->stripMetadata($enabled = true)` | Удалять EXIF (по умолчанию); `false` — сохранить. |
| `->convert($format)` | Формат вывода (`->toFormat` — алиас). |

Валидация выполняется **на стороне клиента, до запроса** — недопустимое значение или
неподдерживаемый формат сразу бросают `SharptownError`.

### Терминальные методы

| Терминал | Возвращает |
| -------- | ---------- |
| `->response()` | `Response` (статус, заголовки, байты) |
| `->bytes()` | сырые байты изображения (`string`) — остаются в памяти |
| `->toStream($stream)` | пишет в поток-ресурс (без диска), возвращает число байт |
| `->toFile($path)` / `->save($path)` | пишет на диск, возвращает путь |

```php
$res = $st->transform($file)->convert('webp')->response();
echo $res->status(), $res->contentType();   // 200 image/webp

$st->transform('in.jpg')->resize(1024)->convert('avif')->toFile('out.avif');
```

## Сокращения

```php
$png   = $st->convert($file, 'png')->bytes();
$small = $st->resize($file, 320, 240)->bytes();
```

## Обработка ошибок

```php
use Sharptown\Client\SharptownError;

try {
    $st->transform($file)->convert('webp')->bytes();
} catch (SharptownError $e) {
    echo $e->getMessage();   // сообщение сервера или валидации
    echo $e->status;         // HTTP-статус / код RPC, если ошибка от сервера
    var_dump($e->body);      // разобранное тело ошибки, если есть
}
```

## Свой транспорт и заголовки

```php
use function Sharptown\Client\{sharptown, rest};

$st = sharptown(
    'http://localhost:3001',
    transport: rest(field: 'image', path: '/api/v1/transform'),
    headers: ['authorization' => 'Bearer …'],
);
```

## Worker-режим (FrankenPHP, RoadRunner) и PHP-FPM

Клиент **без состояния и инстанс-based**, поэтому ведёт себя одинаково в PHP-FPM и в
долгоживущих воркерах:

- **Ресурсы освобождаются детерминированно.** REST-транспорт переиспользует cURL-handle —
  HTTP keep-alive в воркере бесплатно; JSON-RPC-транспорт открывает и закрывает WebSocket в
  блоке `finally`. Ничего не утекает между запросами.
- **Переиспользуйте ради скорости или создавайте на каждый запрос — оба варианта безопасны.**
  В воркере создайте клиент один раз на старте и переиспользуйте, чтобы держать соединения
  тёплыми:

  ```php
  // старт воркера
  $st = sharptown('http://localhost:3001');

  // на каждый запрос
  return $st->transform($_FILES['image']['tmp_name'])->resize(1024)->convert('webp')->bytes();
  ```

- **Один клиент на воркер** — переиспользуемый cURL-handle нельзя шарить между потоками.

## Транспорты

Один и тот же клиент говорит на всех транспортах Sharptown. См.:

- [REST API](/docs/rest-api)
- [JSON-RPC API](/docs/jsonrpc-api)
- [gRPC API](/docs/grpc-api)
