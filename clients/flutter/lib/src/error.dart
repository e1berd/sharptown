/// Thrown for invalid operations (caught before the request is sent) and for unsuccessful
/// server responses.
///
/// [status] carries the HTTP status or JSON-RPC code when the failure came from the server;
/// [body] carries the parsed error payload when one was returned.
class SharptownError implements Exception {
  /// Creates a Sharptown error.
  const SharptownError(this.message, {this.status, this.body});

  /// A human-readable description of what went wrong.
  final String message;

  /// The HTTP status or JSON-RPC code, when the error came from the server.
  final int? status;

  /// The parsed error payload, when present.
  final Object? body;

  @override
  String toString() => 'SharptownError: $message';
}
