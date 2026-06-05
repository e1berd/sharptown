import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../error.dart';
import '../operations.dart';
import '../response.dart';
import 'transport.dart';

/// The JSON-RPC over WebSocket transport. It calls `image.transform` at `{baseURL}/rpc`,
/// sending the image as base64 and receiving the result the same way.
class JsonRpcTransport implements Transport {
  /// Creates a JSON-RPC transport.
  const JsonRpcTransport({this.path = '/rpc', this.method = 'image.transform'});

  /// The WebSocket endpoint path.
  final String path;

  /// The JSON-RPC method name.
  final String method;

  @override
  Future<TransformResponse> transform(TransformRequest request) async {
    final resolved = await request.input.resolve(request.httpClient);

    final payload = jsonEncode({
      'jsonrpc': '2.0',
      'id': 1,
      'method': method,
      'params': {
        'image': base64Encode(resolved.bytes),
        'options': Operations.toOptions(request.operations),
      },
    });

    final channel =
        WebSocketChannel.connect(_wsEndpoint(request.baseUrl, path));
    try {
      await channel.ready.timeout(request.timeout);
    } catch (error) {
      throw SharptownError('WebSocket connection failed: $error');
    }

    channel.sink.add(payload);

    final Object? reply;
    try {
      reply = await channel.stream.first.timeout(request.timeout);
    } catch (error) {
      throw SharptownError('WebSocket read failed: $error');
    } finally {
      unawaited(channel.sink.close());
    }

    return _decode(reply);
  }

  static TransformResponse _decode(Object? reply) {
    final Map<String, Object?> message;
    try {
      message = jsonDecode(reply as String) as Map<String, Object?>;
    } catch (_) {
      throw const SharptownError('Malformed JSON-RPC response');
    }

    final error = message['error'];
    if (error is Map) {
      throw SharptownError(
        (error['message'] as String?) ?? 'JSON-RPC error',
        status: error['code'] as int?,
        body: error,
      );
    }

    final result = message['result'];
    final image = result is Map ? result['image'] : null;
    if (image is! String || image.isEmpty) {
      throw const SharptownError('JSON-RPC response is missing result.image');
    }

    final Uint8List bytes;
    try {
      bytes = base64Decode(image);
    } catch (_) {
      throw const SharptownError('JSON-RPC result.image is not valid base64');
    }

    final contentType =
        (result as Map)['contentType'] as String? ?? 'application/octet-stream';
    return TransformResponse(
      status: 200,
      headers: {'content-type': contentType},
      bytes: bytes,
    );
  }

  static Uri _wsEndpoint(String base, String path) {
    var normalized = base.trim();
    if (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    if (normalized.startsWith('http://')) {
      normalized = 'ws://${normalized.substring(7)}';
    } else if (normalized.startsWith('https://')) {
      normalized = 'wss://${normalized.substring(8)}';
    } else if (!normalized.startsWith('ws://') &&
        !normalized.startsWith('wss://')) {
      normalized = 'ws://$normalized';
    }

    final uri = Uri.parse(normalized);
    if (uri.path.isEmpty || uri.path == '/') {
      return uri.replace(path: path);
    }
    return uri;
  }
}
