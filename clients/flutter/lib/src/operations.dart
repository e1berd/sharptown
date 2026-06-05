import 'error.dart';

/// Operation validation, the canonical option set, and per-transport serialization.
///
/// Option keys match `@sharptown/core` — the same names used by the REST query string and
/// the JSON-RPC `options` object. Each transport translates this canonical set into its own
/// wire format.
abstract final class Operations {
  /// Output formats supported by the server. Mirrors `SUPPORTED_FORMATS` in core.
  static const List<String> supportedFormats = [
    'webp',
    'png',
    'jpg',
    'jpeg',
    'avif',
    'gif',
    'heif',
  ];

  /// Resize fit modes. Mirrors `FIT_MODES` in core.
  static const List<String> fitModes = [
    'cover',
    'contain',
    'fill',
    'inside',
    'outside',
  ];

  /// Canonical option order, matching the JS client's query serialization.
  static const List<String> order = [
    'width',
    'height',
    'dpr',
    'aspectRatio',
    'fit',
    'background',
    'smartCrop',
    'crop',
    'cropOffset',
    'autoOrient',
    'rotate',
    'flip',
    'blur',
    'sharpen',
    'oilPaint',
    'brightness',
    'contrast',
    'saturation',
    'exposure',
    'hue',
    'gamma',
    'colorize',
    'sepia',
    'invert',
    'threshold',
    'r',
    'g',
    'b',
    'grayscale',
    'removeAlpha',
    'ensureAlpha',
    'convertTo',
    'quality',
    'progressive',
    'stripMetadata',
  ];

  /// A non-negative integer — for sizes and radii.
  static int positiveInt(int value, String field) {
    if (value < 0) {
      throw SharptownError(
        'Invalid $field: expected a non-negative integer, got $value',
      );
    }
    return value;
  }

  /// An integer constrained to an inclusive range.
  static int intRange(int value, String field, int min, int max) {
    if (value < min || value > max) {
      throw SharptownError('Invalid $field: expected $min-$max, got $value');
    }
    return value;
  }

  /// A number constrained to an inclusive range.
  static num range(num value, String field, num min, num max) {
    if (value.isNaN || value < min || value > max) {
      throw SharptownError(
        'Invalid $field: expected ${_number(min)}-${_number(max)}, got ${_number(value)}',
      );
    }
    return value;
  }

  /// An integer in the [0, 255] range — for tint colour channels.
  static int color(int value, String field) {
    if (value < 0 || value > 255) {
      throw SharptownError('Invalid $field: expected 0-255, got $value');
    }
    return value;
  }

  /// Asserts that a format is supported by the server.
  static String assertFormat(String format) {
    if (!supportedFormats.contains(format)) {
      throw SharptownError(
        'Unsupported format "$format". Supported: ${supportedFormats.join(', ')}',
      );
    }
    return format;
  }

  /// Asserts that a fit mode is supported by the server.
  static String assertFit(String fit) {
    if (!fitModes.contains(fit)) {
      throw SharptownError(
        'Unsupported fit "$fit". Supported: ${fitModes.join(', ')}',
      );
    }
    return fit;
  }

  /// Serializes canonical operations into a REST query string.
  ///
  /// ```dart
  /// Operations.toQuery({'width': 500, 'convertTo': 'webp'}); // 'width=500&convertTo=webp'
  /// ```
  static String toQuery(Map<String, Object?> ops) {
    final pairs = <String>[];
    for (final key in order) {
      final value = ops[key];
      if (value == null) continue;
      pairs.add(
          '${Uri.encodeQueryComponent(key)}=${Uri.encodeQueryComponent(_stringify(value))}');
    }
    return pairs.join('&');
  }

  /// Returns the set operations as stringified `key => value` pairs, matching the values the
  /// server receives as query parameters. Used to build the signed image-proxy URL.
  static Map<String, String> toParams(Map<String, Object?> ops) {
    final params = <String, String>{};
    for (final key in order) {
      final value = ops[key];
      if (value != null) params[key] = _stringify(value);
    }
    return params;
  }

  /// Returns the canonical operations as a JSON-RPC `options` object: only the keys that
  /// were set, in canonical order, keeping native value types.
  static Map<String, Object?> toOptions(Map<String, Object?> ops) {
    final options = <String, Object?>{};
    for (final key in order) {
      final value = ops[key];
      if (value != null) options[key] = value;
    }
    return options;
  }

  static String _stringify(Object value) {
    if (value is bool) return value ? 'true' : 'false';
    if (value is num) return _number(value);
    return value.toString();
  }

  static String _number(num value) {
    if (value is int || value == value.truncate()) {
      return value.toInt().toString();
    }
    return value.toString();
  }
}
