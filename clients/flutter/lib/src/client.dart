import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

import 'error.dart';
import 'input.dart';
import 'operations.dart';
import 'transform.dart';
import 'transport/rest.dart';
import 'transport/transport.dart';
import 'url.dart';

/// The Sharptown client. Create one with [SharptownClient.new].
///
/// The base URL points at the host for the chosen transport: the REST host (`…:3001`) or the
/// JSON-RPC WebSocket host (`…:3002`). The scheme is optional and defaults to the secure
/// variant — `localhost:3001` becomes `https://localhost:3001`; pass `http://` explicitly for
/// plain HTTP.
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
    String? proxySecret,
    String proxyPath = '/api/v1/fetch',
  })  : baseUrl = _normalizeBaseUrl(url),
        _transport = transport ?? const RestTransport(),
        _headers = headers ?? const {},
        _timeout = timeout,
        _ownsHttpClient = httpClient == null,
        _httpClient = httpClient ?? http.Client(),
        _proxySecret = proxySecret,
        _proxyPath = proxyPath;

  /// The normalized server base URL.
  final String baseUrl;

  final Transport _transport;
  final Map<String, String> _headers;
  final Duration _timeout;
  final http.Client _httpClient;
  final bool _ownsHttpClient;
  final String? _proxySecret;
  final String _proxyPath;

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

  /// Builds a signed image-proxy URL for the server's `GET /fetch` endpoint, suitable for an
  /// `<img>` tag. The server downloads [source], applies [operations], and serves a cached
  /// result. The HMAC-SHA256 signature covers the source URL and every operation. Requires a
  /// `proxySecret`; sign on a trusted server only, never ship the secret to a public app.
  ///
  /// ```dart
  /// final st = SharptownClient('https://img.example.com', proxySecret: secret);
  /// final src = st.signedUrl('https://example.com/photo.jpg', {'width': 800, 'convertTo': 'webp'});
  /// ```
  String signedUrl(String source, [Map<String, Object?> operations = const {}]) {
    if (source.isEmpty) {
      throw const SharptownError('signedUrl: source is required');
    }
    final secret = _proxySecret;
    if (secret == null || secret.isEmpty) {
      throw const SharptownError('signedUrl requires a proxySecret');
    }

    final params = <String, String>{...Operations.toParams(operations), 'url': source};
    final keys = params.keys.toList()..sort();

    final canonical = keys.map((key) => '$key=${params[key]}').join('&');
    final mac = Hmac(sha256, utf8.encode(secret)).convert(utf8.encode(canonical));
    final signature = base64Url.encode(mac.bytes).replaceAll('=', '');

    final query = [
      for (final key in keys)
        '${Uri.encodeQueryComponent(key)}=${Uri.encodeQueryComponent(params[key]!)}',
      'sig=$signature',
    ].join('&');

    return '${httpBase(baseUrl)}$_proxyPath?$query';
  }

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
