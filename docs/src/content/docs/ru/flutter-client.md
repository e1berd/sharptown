---
title: Dart / Flutter-клиент
description: Выразительный клиент для Dart и Flutter с транспортами REST и JSON-RPC и тем же цепочечным API, что и у остальных клиентов.
group: Guide
order: 6
---

# Dart / Flutter-клиент

Dart-клиент даёт единый цепочечный API для двух транспортов — REST (по умолчанию) и
**JSON-RPC** поверх WebSocket — выбираемых при создании клиента. Он работает во Flutter
(мобильные, десктоп) и в обычном Dart и целиком построен на `async`/`await`.

## Установка

Dart-клиент **не опубликован на pub.dev** — он лежит в репозитории в `clients/flutter`.
Добавьте его как Git-зависимость, указывающую на этот подкаталог:

```yaml
dependencies:
  sharptown:
    git:
      url: https://github.com/e1berd/sharptown
      path: clients/flutter
```

```dart
import 'package:sharptown/sharptown.dart';
```

Зависит только от `http` (REST) и `web_socket_channel` (JSON-RPC). `ImageInput.file`,
`ImageInput.path` и `TransformResponse.save` используют `dart:io`; на Flutter Web берите
`ImageInput.bytes` / `ImageInput.url` и читайте `response.bytes`.

## Создание клиента

```dart
final st = SharptownClient(
  'http://localhost:3001',
  timeout: const Duration(seconds: 15),
  headers: {'authorization': 'Bearer …'},
);
```

Параметры: `transport`, `headers`, `timeout`, `httpClient`. Базовый URL должен
соответствовать выбранному транспорту. Вызовите `st.close()` по завершении, если не
передавали собственный `httpClient`.

## Выбор транспорта

```dart
// REST (по умолчанию) — multipart POST на /api/v1/transform
SharptownClient('http://localhost:3001');

// JSON-RPC поверх WebSocket — image.transform на /rpc
SharptownClient('ws://localhost:3002', transport: const JsonRpcTransport());
```

Оба транспорта принимают один и тот же билдер и возвращают один и тот же
`TransformResponse`, поэтому замена транспорта не меняет код вызова.

## Входы

```dart
ImageInput.bytes(buffer, 'photo.jpg');          // Uint8List в памяти
ImageInput.file(File('photo.jpg'));             // dart:io File
ImageInput.path('photo.jpg');                   // удобство: чтение с диска
ImageInput.url('https://example.com/cat.jpg');  // удобство: загрузка по HTTP
```

Типичный обработчик во Flutter, целиком в памяти:

```dart
Future<Uint8List> thumbnail(Uint8List picked) {
  return st
      .transform(ImageInput.bytes(picked, 'upload.jpg'))
      .width(1024)
      .convert('webp')
      .bytes();
}
```

## Операции

Размер и кадрирование: `resize`, `width`, `height`, `crop`, `smartCrop`, `fit`,
`background`, `dpr`, `aspectRatio`, `autoOrient`, `rotate`, `flip`.
Тон и цвет: `brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
`colorize`, `tint`, `grayscale`.
Фильтры и эффекты: `blur`, `sharpen`, `sepia`, `invert`, `threshold`, `oilPaint`.
Альфа и вывод: `removeAlpha`, `ensureAlpha`, `convert`, `quality`, `progressive`,
`stripMetadata`, `keepMetadata`.

Валидация происходит по ходу построения; первая недопустимая величина (вне диапазона,
неподдерживаемый формат) сразу бросает `SharptownError`, до отправки запроса.

## Терминальные методы

```dart
final res = await t.response();   // TransformResponse (status, headers, bytes)
final data = await t.bytes();     // Uint8List
final file = await t.save('out.webp');
```

## Ошибки

```dart
try {
  await st.transform(input).convert('webp').bytes();
} on SharptownError catch (e) {
  print('${e.status}: ${e.message}'); // HTTP-статус / код RPC + сообщение
}
```

## Транспорты

Один и тот же клиент говорит на всех транспортах Sharptown. См. [REST API](/ru/docs/rest-api)
и [JSON-RPC API](/ru/docs/jsonrpc-api).
