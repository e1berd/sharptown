import 'dart:io';
import 'dart:typed_data';

/// The result of a transform: the image bytes plus the response status and headers.
/// Returned by every transport.
class TransformResponse {
  /// Creates a transform response.
  const TransformResponse({
    required this.status,
    required this.headers,
    required this.bytes,
  });

  /// The HTTP status code (always 200 for JSON-RPC successes).
  final int status;

  /// The response headers, with lower-cased keys.
  final Map<String, String> headers;

  /// The transformed image bytes.
  final Uint8List bytes;

  /// The response `content-type` header, if present.
  String? get contentType => headers['content-type'];

  /// Writes the image bytes to a file and returns the written [File].
  ///
  /// ```dart
  /// await response.save('out.webp');
  /// ```
  Future<File> save(String path) => File(path).writeAsBytes(bytes);
}
