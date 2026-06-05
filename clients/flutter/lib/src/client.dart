import 'package:http/http.dart' as http;

import 'error.dart';
import 'input.dart';
import 'transform.dart';
import 'transport/rest.dart';
import 'transport/transport.dart';

/// The Sharptown client. Create one with [SharptownClient.new].
///
/// The base URL must match the chosen transport: the REST host (`http://…:3001`) or the
/// JSON-RPC WebSocket host (`ws://…:3002`).
///
/// ```dart
/// final st = SharptownClient('http://localhost:3001');
/// final webp = await st.transform(ImageInput.path('photo.jpg')).resize(800).convert('webp').bytes();
/// ```
class SharptownClient {
  /// Creates a client for [url].
  ///
  /// - [transport] selects the protocol (defaults to [RestTransport]).
  /// - [headers] are sent with every request.
  /// - [timeout] bounds each request (defaults to 30 seconds).
  /// - [httpClient] lets you inject a custom `package:http` client; if you pass one, you own
  ///   its lifecycle — otherwise [close] disposes the internally created one.
  SharptownClient(
    String url, {
    Transport? transport,
    Map<String, String>? headers,
    Duration timeout = const Duration(seconds: 30),
    http.Client? httpClient,
  })  : baseUrl = _normalizeBaseUrl(url),
        _transport = transport ?? const RestTransport(),
        _headers = headers ?? const {},
        _timeout = timeout,
        _ownsHttpClient = httpClient == null,
        _httpClient = httpClient ?? http.Client();

  /// The normalized server base URL.
  final String baseUrl;

  final Transport _transport;
  final Map<String, String> _headers;
  final Duration _timeout;
  final http.Client _httpClient;
  final bool _ownsHttpClient;

  /// Starts an image transformation chain for [input].
  ///
  /// ```dart
  /// st.transform(ImageInput.file(file)).resize(400).blur(2).convert('webp').save('out.webp');
  /// ```
  TransformBuilder transform(ImageInput input) {
    return TransformBuilder(
      transport: _transport,
      baseUrl: baseUrl,
      headers: _headers,
      timeout: _timeout,
      httpClient: _httpClient,
      input: input,
    );
  }

  /// Shortcut: format conversion only.
  TransformBuilder convert(ImageInput input, String format) =>
      transform(input).convert(format);

  /// Shortcut: resize only.
  TransformBuilder resize(ImageInput input, [int? width, int? height]) =>
      transform(input).resize(width, height);

  /// Closes the underlying HTTP client, unless one was supplied at construction.
  void close() {
    if (_ownsHttpClient) _httpClient.close();
  }

  static String _normalizeBaseUrl(String url) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      throw const SharptownError(
          'SharptownClient(url): url must be a non-empty string');
    }
    return trimmed.endsWith('/')
        ? trimmed.substring(0, trimmed.length - 1)
        : trimmed;
  }
}
