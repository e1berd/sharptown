/// Resolves a user-supplied base URL to a concrete scheme. The scheme is optional: a bare
/// `localhost:3001` is accepted and defaults to the secure variant. An explicit `http`/`ws`
/// selects the insecure variant; any other scheme is treated as secure. The transport owns
/// the protocol family (REST → `http`/`https`, JSON-RPC → `ws`/`wss`).
library;

final RegExp _scheme = RegExp(r'^([a-zA-Z][a-zA-Z0-9+.\-]*)://');

/// Resolves [base] for the HTTP family (`http`/`https`).
String httpBase(String base) => _withScheme(base, 'https', 'http');

/// Resolves [base] for the WebSocket family (`ws`/`wss`).
String wsBase(String base) => _withScheme(base, 'wss', 'ws');

String _withScheme(String base, String secure, String insecure) {
  var trimmed = base.trim();
  if (trimmed.endsWith('/')) {
    trimmed = trimmed.substring(0, trimmed.length - 1);
  }

  final match = _scheme.firstMatch(trimmed);
  if (match == null) {
    return '$secure://$trimmed';
  }

  final scheme = match.group(1)!.toLowerCase();
  final authority = trimmed.substring(match.end);
  final prefix = scheme == 'http' || scheme == 'ws' ? insecure : secure;
  return '$prefix://$authority';
}
