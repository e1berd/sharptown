import 'dart:convert';

import 'package:http/http.dart' as http;

import '../error.dart';
import '../operations.dart';
import '../response.dart';
import 'transport.dart';

/// The default transport: a multipart `POST` to `{baseURL}/api/v1/transform`, with the
/// operations serialized into the query string and the image sent as the `image` field.
class RestTransport implements Transport {
  /// Creates a REST transport.
  const RestTransport({this.path = '/api/v1/transform', this.field = 'image'});

  /// The transform endpoint path.
  final String path;

  /// The multipart field name carrying the image.
  final String field;

  @override
  Future<TransformResponse> transform(TransformRequest request) async {
    final resolved = await request.input.resolve(request.httpClient);

    final query = Operations.toQuery(request.operations);
    final endpoint = '${request.baseUrl}$path${query.isEmpty ? '' : '?$query'}';

    final multipart = http.MultipartRequest('POST', Uri.parse(endpoint))
      ..headers.addAll(request.headers)
      ..files.add(http.MultipartFile.fromBytes(
        field,
        resolved.bytes,
        filename: resolved.filename,
      ));

    final http.Response response;
    try {
      final streamed =
          await request.httpClient.send(multipart).timeout(request.timeout);
      response = await http.Response.fromStream(streamed);
    } catch (error) {
      throw SharptownError('HTTP request failed: $error');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _restError(response);
    }

    return TransformResponse(
      status: response.statusCode,
      headers: response.headers,
      bytes: response.bodyBytes,
    );
  }

  static SharptownError _restError(http.Response response) {
    var message = 'Sharptown request failed with status ${response.statusCode}';
    Object? body;
    try {
      final parsed = jsonDecode(response.body);
      body = parsed;
      if (parsed is Map && parsed['error'] is String) {
        message = parsed['error'] as String;
      }
    } catch (_) {
      body = null;
    }
    return SharptownError(message, status: response.statusCode, body: body);
  }
}
