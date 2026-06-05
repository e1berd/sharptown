import 'package:http/http.dart' as http;

import '../input.dart';
import '../response.dart';

/// The canonical, protocol-independent input handed to a [Transport].
class TransformRequest {
  /// Creates a transform request.
  const TransformRequest({
    required this.baseUrl,
    required this.headers,
    required this.input,
    required this.operations,
    required this.timeout,
    required this.httpClient,
  });

  /// The server base URL, matching the chosen transport.
  final String baseUrl;

  /// Default headers sent with every request.
  final Map<String, String> headers;

  /// The image source.
  final ImageInput input;

  /// The canonical operation set.
  final Map<String, Object?> operations;

  /// The per-request timeout.
  final Duration timeout;

  /// The HTTP client used by the REST transport and for [ImageInput.url] sources.
  final http.Client httpClient;
}

/// Speaks one of the Sharptown protocols. Each implementation accepts the same
/// [TransformRequest] and returns the same [TransformResponse], so swapping one transport
/// for another never changes calling code.
abstract interface class Transport {
  /// Runs a single transform over this transport.
  Future<TransformResponse> transform(TransformRequest request);
}
