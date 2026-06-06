/// Expressive Dart and Flutter client for the Sharptown image transformation API.
///
/// One fluent API across two transports — REST (default) and JSON-RPC over WebSocket —
/// selected when the client is created. Swapping transports never changes calling code.
///
/// ```dart
/// final st = SharptownClient('http://localhost:3001');
///
/// final bytes = await st
///     .transform(ImageInput.path('photo.jpg'))
///     .resize(800, 600)
///     .blur(3)
///     .grayscale()
///     .convert('webp')
///     .bytes();
/// ```
library;

export 'src/client.dart';
export 'src/error.dart';
export 'src/input.dart';
export 'src/operations.dart' show Operations;
export 'src/response.dart';
export 'src/transform.dart';
export 'src/watermark.dart' show Watermark, Textmark, CompositeMark;
export 'src/transport/json_rpc.dart';
export 'src/transport/rest.dart';
export 'src/transport/transport.dart';
